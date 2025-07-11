import { ethers } from "ethers";
import { parse } from "envfile";
import * as fs from "fs";
import passwordPrompt from "@inquirer/password";
import { input as inputPrompt } from "@inquirer/prompts";

const envFilePath = "./.env";

async function main() {
  if (!fs.existsSync(envFilePath)) {
    console.error("❌ .env file not found. Please generate a deployer account first.");
    process.exit(1);
  }

  const envConfig = parse(fs.readFileSync(envFilePath).toString());
  const encryptedJson = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
  if (!encryptedJson) {
    console.error("❌ DEPLOYER_PRIVATE_KEY_ENCRYPTED not found in .env. Please generate a deployer account first.");
    process.exit(1);
  }

  // Prompt for password
  const pass = await passwordPrompt({ message: "Enter password to decrypt deployer private key:" });

  let wallet: ethers.Wallet;
  try {
    wallet = (await ethers.Wallet.fromEncryptedJson(encryptedJson, pass)) as ethers.Wallet;
  } catch (e) {
    console.error("❌ Failed to decrypt wallet. Check your password.");
    process.exit(1);
  }

  // Prompt for recipient address
  const to = await inputPrompt({ message: "Enter recipient address:" });
  if (!ethers.isAddress(to)) {
    console.error("❌ Invalid recipient address.");
    process.exit(1);
  }

  // Prompt for amount
  const amountStr = await inputPrompt({ message: "Enter amount of ETH to send:" });
  let amount: bigint;
  try {
    amount = ethers.parseEther(amountStr);
  } catch (e) {
    console.error("❌ Invalid amount.");
    process.exit(1);
  }

  // Prompt for RPC URL (optional)
  let rpcUrl = await inputPrompt({ message: "Enter RPC URL (leave blank for default: https://sepolia.drpc.org):" });
  if (!rpcUrl) {
    rpcUrl = "https://sepolia.drpc.org";
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = wallet.connect(provider);

  // Show deployer balance
  const balance = await provider.getBalance(deployer.address);
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);
  if (balance < amount) {
    console.error("❌ Insufficient balance.");
    process.exit(1);
  }

  // Send transaction
  try {
    const tx = await deployer.sendTransaction({ to, value: amount });
    console.log("⏳ Sending transaction...");
    const receipt = await tx.wait();
    if (receipt) {
      console.log(`✅ Transaction sent! Hash: ${tx.hash}`);
      console.log(`Status: ${receipt.status ? "Success" : "Failed"}`);
    } else {
      console.log(`Transaction sent! Hash: ${tx.hash} (no receipt returned)`);
    }
  } catch (e) {
    console.error("❌ Transaction failed:", e);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}); 