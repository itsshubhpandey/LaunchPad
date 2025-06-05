import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import { SwapVert } from '@mui/icons-material';
import { useKongSwap } from '../hooks/useKongSwap';
import { Principal } from '@dfinity/principal';

const KongSwapTrading = () => {
  const { tokens, loading, error, getSwapQuote, executeSwap } = useKongSwap();
  const [tokenIn, setTokenIn] = useState(null);
  const [tokenOut, setTokenOut] = useState(null);
  const [amountIn, setAmountIn] = useState('');
  const [quote, setQuote] = useState(null);
  const [swapping, setSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState(null);

  const handleSwapTokens = () => {
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    setAmountIn('');
    setQuote(null);
  };

  const handleGetQuote = async () => {
    if (!tokenIn || !tokenOut || !amountIn) return;

    try {
      const amountInBigInt = BigInt(parseFloat(amountIn) * Math.pow(10, tokenIn.decimals));
      const quoteResult = await getSwapQuote(
        tokenIn.canister_id,
        tokenOut.canister_id,
        amountInBigInt
      );
      setQuote(quoteResult);
    } catch (err) {
      console.error('Failed to get quote:', err);
    }
  };

  const handleExecuteSwap = async () => {
    if (!tokenIn || !tokenOut || !quote || !amountIn) return;

    setSwapping(true);
    try {
      const amountInBigInt = BigInt(parseFloat(amountIn) * Math.pow(10, tokenIn.decimals));
      const success = await executeSwap(
        tokenIn.canister_id,
        tokenOut.canister_id,
        amountInBigInt,
        quote.minimum_received
      );

      if (success) {
        setSwapResult('Swap executed successfully!');
        setAmountIn('');
        setQuote(null);
      } else {
        setSwapResult('Swap failed. Please try again.');
      }
    } catch (err) {
      setSwapResult('Swap failed with error.');
    } finally {
      setSwapping(false);
    }
  };

  useEffect(() => {
    if (tokenIn && tokenOut && amountIn) {
      const timer = setTimeout(handleGetQuote, 500);
      return () => clearTimeout(timer);
    }
  }, [tokenIn, tokenOut, amountIn]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom align="center">
          🦍 KongSwap Trading
        </Typography>
        
        {swapResult && (
          <Alert 
            severity={swapResult.includes('successfully') ? 'success' : 'error'}
            sx={{ mb: 2 }}
            onClose={() => setSwapResult(null)}
          >
            {swapResult}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>From Token</InputLabel>
            <Select
              value={tokenIn?.symbol || ''}
              onChange={(e) => {
                const token = tokens.find(t => t.symbol === e.target.value);
                setTokenIn(token || null);
              }}
            >
              {tokens.map((token) => (
                <MenuItem key={token.symbol} value={token.symbol}>
                  {token.name} ({token.symbol})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="0.00"
          />
        </Box>

        <Box display="flex" justifyContent="center" sx={{ mb: 3 }}>
          <Button
            onClick={handleSwapTokens}
            sx={{ minWidth: 'auto', p: 1, borderRadius: '50%' }}
          >
            <SwapVert />
          </Button>
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>To Token</InputLabel>
            <Select
              value={tokenOut?.symbol || ''}
              onChange={(e) => {
                const token = tokens.find(t => t.symbol === e.target.value);
                setTokenOut(token || null);
              }}
            >
              {tokens.map((token) => (
                <MenuItem key={token.symbol} value={token.symbol}>
                  {token.name} ({token.symbol})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="You will receive (estimated)"
            value={
              quote
                ? (Number(quote.amount_out) / Math.pow(10, tokenOut?.decimals || 8)).toFixed(6)
                : ''
            }
            disabled
            sx={{ mb: 2 }}
          />
        </Box>

        {quote && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Price Impact: {quote.price_impact.toFixed(2)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Minimum Received: {(Number(quote.minimum_received) / Math.pow(10, tokenOut?.decimals || 8)).toFixed(6)} {tokenOut?.symbol}
            </Typography>
          </Box>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleExecuteSwap}
          disabled={!tokenIn || !tokenOut || !amountIn || !quote || swapping}
          sx={{ mt: 2 }}
        >
          {swapping ? <CircularProgress size={24} /> : 'Swap Tokens'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default KongSwapTrading;

// Additional utility functions for KongSwap integration
// src/icplaunchpad_frontend/src/utils/kongswapHelpers.js

import { Principal } from '@dfinity/principal';

// Helper function to format token amounts
export const formatTokenAmount = (amount, decimals = 8) => {
  const formattedAmount = Number(amount) / Math.pow(10, decimals);
  return formattedAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
};

// Helper function to parse token amounts
export const parseTokenAmount = (amount, decimals = 8) => {
  return BigInt(parseFloat(amount) * Math.pow(10, decimals));
};

// Helper function to calculate price impact
export const calculatePriceImpact = (amountIn, amountOut, reserveIn, reserveOut) => {
  if (!reserveIn || !reserveOut || !amountIn || !amountOut) return 0;
  
  const spotPrice = Number(reserveOut) / Number(reserveIn);
  const executionPrice = Number(amountOut) / Number(amountIn);
  const priceImpact = Math.abs((spotPrice - executionPrice) / spotPrice) * 100;
  
  return priceImpact;
};

// Helper function to validate Principal
export const isValidPrincipal = (principalText) => {
  try {
    Principal.fromText(principalText);
    return true;
  } catch (error) {
    return false;
  }
};

// Helper function to get token pair key
export const getTokenPairKey = (tokenA, tokenB) => {
  const [token0, token1] = [tokenA.toString(), tokenB.toString()].sort();
  return `${token0}-${token1}`;
};

// Helper function to calculate slippage tolerance
export const calculateMinimumReceived = (expectedAmount, slippageTolerance = 0.05) => {
  const slippageMultiplier = BigInt(Math.floor((1 - slippageTolerance) * 100));
  return (expectedAmount * slippageMultiplier) / BigInt(100);
};

// Package.json updates for JavaScript version
export const packageJsonUpdates = {
  "dependencies": {
    "@dfinity/agent": "^0.20.0",
    "@dfinity/candid": "^0.20.0",
    "@dfinity/principal": "^0.20.0",
    "@dfinity/auth-client": "^0.20.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "styled-components": "^5.3.9",
    "@mui/material": "^5.11.0",
    "@emotion/react": "^11.10.5",
    "@emotion/styled": "^11.10.5",
    "recharts": "^2.5.0",
    "web3": "^1.8.2",
    "prop-types": "^15.8.1"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@babel/preset-env": "^7.20.0",
    "@babel/preset-react": "^7.18.0",
    "eslint": "^8.30.0",
    "eslint-plugin-react": "^7.31.0",
    "eslint-plugin-react-hooks": "^4.6.0"
  }
};

// Simple context provider for KongSwap (optional)
// src/icplaunchpad_frontend/src/context/KongSwapContext.jsx
import React, { createContext, useContext, useReducer } from 'react';

const KongSwapContext = createContext();

const initialState = {
  tokens: [],
  pools: [],
  userBalances: {},
  selectedTokenIn: null,
  selectedTokenOut: null,
  swapHistory: [],
};

const kongSwapReducer = (state, action) => {
  switch (action.type) {
    case 'SET_TOKENS':
      return { ...state, tokens: action.payload };
    case 'SET_POOLS':
      return { ...state, pools: action.payload };
    case 'SET_USER_BALANCES':
      return { ...state, userBalances: action.payload };
    case 'SET_SELECTED_TOKEN_IN':
      return { ...state, selectedTokenIn: action.payload };
    case 'SET_SELECTED_TOKEN_OUT':
      return { ...state, selectedTokenOut: action.payload };
    case 'ADD_SWAP_TO_HISTORY':
      return { 
        ...state, 
        swapHistory: [action.payload, ...state.swapHistory.slice(0, 9)] 
      };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
};

export const KongSwapProvider = ({ children }) => {
  const [state, dispatch] = useReducer(kongSwapReducer, initialState);

  const value = {
    state,
    dispatch,
    setTokens: (tokens) => dispatch({ type: 'SET_TOKENS', payload: tokens }),
    setPools: (pools) => dispatch({ type: 'SET_POOLS', payload: pools }),
    setUserBalances: (balances) => dispatch({ type: 'SET_USER_BALANCES', payload: balances }),
    setSelectedTokenIn: (token) => dispatch({ type: 'SET_SELECTED_TOKEN_IN', payload: token }),
    setSelectedTokenOut: (token) => dispatch({ type: 'SET_SELECTED_TOKEN_OUT', payload: token }),
    addSwapToHistory: (swap) => dispatch({ type: 'ADD_SWAP_TO_HISTORY', payload: swap }),
    resetState: () => dispatch({ type: 'RESET_STATE' }),
  };

  return (
    <KongSwapContext.Provider value={value}>
      {children}
    </KongSwapContext.Provider>
  );
};

export const useKongSwapContext = () => {
  const context = useContext(KongSwapContext);
  if (!context) {
    throw new Error('useKongSwapContext must be used within a KongSwapProvider');
  }
  return context;
};