import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getKeyStore } from "../wallet/key-store";

const FAUCET_URL = "https://base-sepolia-faucet.skale.space";
const MAX_WAIT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimViaWebview(address: string): Promise<{ success: boolean; message: string }> {
  const webview = new Bun.WebView({
    url: FAUCET_URL,
    width: 800,
    height: 600,
  });

  try {
    await sleep(3000);

    // Fill address input and submit
    const fillResult = await webview.evaluate(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const addressInput = inputs.find(i =>
          i.placeholder?.toLowerCase().includes('address') ||
          i.name?.toLowerCase().includes('address') ||
          i.id?.toLowerCase().includes('address')
        );
        if (!addressInput) return { ok: false, reason: 'No address input found' };
        addressInput.value = '${address}';
        addressInput.dispatchEvent(new Event('input', { bubbles: true }));

        const buttons = Array.from(document.querySelectorAll('button'));
        const claimBtn = buttons.find(b =>
          b.textContent?.toLowerCase().includes('claim') ||
          b.textContent?.toLowerCase().includes('submit') ||
          b.textContent?.toLowerCase().includes('request') ||
          b.type === 'submit'
        );
        if (!claimBtn) return { ok: false, reason: 'No claim button found' };
        claimBtn.click();
        return { ok: true, reason: 'Clicked' };
      })()
    `) as { ok: boolean; reason: string };

    if (!fillResult.ok) {
      return { success: false, message: fillResult.reason };
    }

    await sleep(5000);

    // Check for success / error indicators
    const statusResult = await webview.evaluate(`
      (() => {
        const body = document.body.innerText.toLowerCase();
        if (body.includes('success') || body.includes('sent') || body.includes('confirmed') || body.includes('claimed')) {
          return { type: 'success', text: document.body.innerText.slice(0, 200) };
        }
        if (body.includes('error') || body.includes('failed') || body.includes('limit') || body.includes('already') || body.includes('wait')) {
          return { type: 'error', text: document.body.innerText.slice(0, 200) };
        }
        return { type: 'unknown', text: '' };
      })()
    `) as { type: string; text: string };

    if (statusResult.type === "success") {
      return { success: true, message: statusResult.text || "Faucet claim submitted" };
    }
    if (statusResult.type === "error") {
      return { success: false, message: statusResult.text || "Faucet claim failed" };
    }

    return { success: true, message: "Claim submitted — check balance shortly" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `WebView error: ${msg}` };
  } finally {
    webview.close();
  }
}

export const claimSkaleGas = tool(
  async () => {
    try {
      const ks = getKeyStore();
      const address = ks.getAddress();

      const result = await claimViaWebview(address);

      return JSON.stringify({
        success: result.success,
        address,
        faucetUrl: FAUCET_URL,
        message: result.message,
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "claim_skale_gas",
    description: `Claim SKALE Base gas credits from the web faucet at ${FAUCET_URL}. Uses Bun's native WebView (OS webview, no Chromium download) to fill in the agent's address and submit the claim. Call when credit balance is low.`,
    schema: z.object({}),
  },
);
