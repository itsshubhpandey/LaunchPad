import { useState, useEffect } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory } from '../declarations/icplaunchpad_backend';

export const useKongSwap = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const agent = new HttpAgent({
    host: process.env.DFX_NETWORK === 'local' ? 'http://localhost:4943' : 'https://ic0.app',
  });

  const actor = Actor.createActor(idlFactory, {
    agent,
    canisterId: process.env.CANISTER_ID_ICPLAUNCHPAD_BACKEND,
  });

  const fetchTokens = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await actor.get_available_tokens();
      if ('Ok' in result) {
        setTokens(result.Ok);
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens');
    } finally {
      setLoading(false);
    }
  };

  const getSwapQuote = async (tokenIn, tokenOut, amountIn) => {
    try {
      const result = await actor.get_swap_quote(tokenIn, tokenOut, amountIn);
      if ('Ok' in result) {
        return {
          amount_out: result.Ok,
          price_impact: 0.5, // Calculate based on pool reserves
          minimum_received: (result.Ok * BigInt(95)) / BigInt(100), // 5% slippage
        };
      }
      return null;
    } catch (err) {
      console.error('Failed to get swap quote:', err);
      return null;
    }
  };

  const executeSwap = async (tokenIn, tokenOut, amountIn, amountOutMin) => {
    try {
      setLoading(true);
      const result = await actor.swap_tokens(tokenIn, tokenOut, amountIn, amountOutMin);
      return 'Ok' in result;
    } catch (err) {
      console.error('Swap failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  return {
    tokens,
    loading,
    error,
    fetchTokens,
    getSwapQuote,
    executeSwap,
  };
};