mod kongswap_service;

use candid::{CandidType, Principal};
use ic_cdk_macros::*;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{BoundedStorable, DefaultMemoryImpl, StableBTreeMap, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::HashMap;

use kongswap_service::{KongSwapService, SwapArgs, AddLiquidityArgs};

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct LaunchpadProject {
    pub id: u64,
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub total_supply: u64,
    pub target_funding: u64,
    pub current_funding: u64,
    pub creator: Principal,
    pub token_canister_id: Option<Principal>,
    pub kong_pool_id: Option<u64>,
    pub is_launched: bool,
    pub launch_timestamp: u64,
}

impl Storable for LaunchpadProject {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }
}

impl BoundedStorable for LaunchpadProject {
    const MAX_SIZE: u32 = 1024;
    const IS_FIXED_SIZE: bool = false;
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    static PROJECTS: RefCell<StableBTreeMap<u64, LaunchpadProject, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        )
    );

    static KONG_SERVICE: RefCell<Option<KongSwapService>> = RefCell::new(None);
    static PROJECT_COUNTER: RefCell<u64> = RefCell::new(0);
}

// Initialize KongSwap service
#[init]
fn init(kong_canister_id: Principal) {
    KONG_SERVICE.with(|service| {
        *service.borrow_mut() = Some(KongSwapService::new(kong_canister_id));
    });
}

// Create a new launchpad project
#[update]
async fn create_project(
    name: String,
    symbol: String,
    description: String,
    total_supply: u64,
    target_funding: u64,
) -> Result<u64, String> {
    let caller = ic_cdk::caller();
    let project_id = PROJECT_COUNTER.with(|counter| {
        let id = *counter.borrow();
        *counter.borrow_mut() = id + 1;
        id
    });

    let project = LaunchpadProject {
        id: project_id,
        name,
        symbol,
        description,
        total_supply,
        target_funding,
        current_funding: 0,
        creator: caller,
        token_canister_id: None,
        kong_pool_id: None,
        is_launched: false,
        launch_timestamp: 0,
    };

    PROJECTS.with(|projects| {
        projects.borrow_mut().insert(project_id, project);
    });

    Ok(project_id)
}

// Launch project and create KongSwap pool
#[update]
async fn launch_project(project_id: u64, initial_icp_liquidity: u64) -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Get project
    let mut project = PROJECTS.with(|projects| {
        projects.borrow().get(&project_id).ok_or("Project not found".to_string())
    })?;

    // Check if caller is the creator
    if project.creator != caller {
        return Err("Only project creator can launch".to_string());
    }

    // Check if already launched
    if project.is_launched {
        return Err("Project already launched".to_string());
    }

    // Check if funding target is met
    if project.current_funding < project.target_funding {
        return Err("Funding target not met".to_string());
    }

    // Create token and pool on KongSwap
    let kong_service = KONG_SERVICE.with(|service| {
        service.borrow().as_ref().ok_or("KongSwap service not initialized".to_string()).cloned()
    })?;

    let (token_id, pool_id) = kong_service.create_token_and_pool(
        project.symbol.clone(),
        project.name.clone(),
        project.total_supply,
        initial_icp_liquidity,
    ).await?;

    // Update project
    project.token_canister_id = Some(token_id);
    project.kong_pool_id = Some(pool_id);
    project.is_launched = true;
    project.launch_timestamp = ic_cdk::api::time();

    PROJECTS.with(|projects| {
        projects.borrow_mut().insert(project_id, project);
    });

    Ok(format!("Project launched successfully! Token ID: {}, Pool ID: {}", token_id, pool_id))
}

// Get project information
#[query]
fn get_project(project_id: u64) -> Option<LaunchpadProject> {
    PROJECTS.with(|projects| {
        projects.borrow().get(&project_id)
    })
}

// Get all projects
#[query]
fn get_all_projects() -> Vec<LaunchpadProject> {
    PROJECTS.with(|projects| {
        projects.borrow().iter().map(|(_, project)| project).collect()
    })
}

// Swap tokens through KongSwap
#[update]
async fn swap_tokens(
    token_in: Principal,
    token_out: Principal,
    amount_in: u64,
    amount_out_min: u64,
) -> Result<u64, String> {
    let caller = ic_cdk::caller();
    let kong_service = KONG_SERVICE.with(|service| {
        service.borrow().as_ref().ok_or("KongSwap service not initialized".to_string()).cloned()
    })?;

    let swap_args = SwapArgs {
        token_in,
        token_out,
        amount_in,
        amount_out_min,
        to: caller,
        deadline: ic_cdk::api::time() + 3600_000_000_000, // 1 hour
    };

    kong_service.swap_tokens(swap_args).await
}

// Get swap quote
#[query]
async fn get_swap_quote(token_in: Principal, token_out: Principal, amount_in: u64) -> Result<u64, String> {
    let kong_service = KONG_SERVICE.with(|service| {
        service.borrow().as_ref().ok_or("KongSwap service not initialized".to_string()).cloned()
    })?;

    kong_service.get_quote(token_in, token_out, amount_in).await
}

// Get available tokens from KongSwap
#[query]
async fn get_available_tokens() -> Result<Vec<kongswap_service::Token>, String> {
    let kong_service = KONG_SERVICE.with(|service| {
        service.borrow().as_ref().ok_or("KongSwap service not initialized".to_string()).cloned()
    })?;

    kong_service.get_tokens().await
}
