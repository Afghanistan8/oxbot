import { getCurrentUserId } from "@/lib/session";
import { getUnnotifiedWins } from "@/server/queries/profile";
import { WinToastNotifier } from "@/components/notifications/win-toast";

/**
 * Mounted once in the root layout so a winner sees their "you won!" toast on
 * whichever page they land on next — not only the specific giveaway's page.
 * Signed-out visitors never query the DB for this.
 */
export async function WinNotifierGate() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const wins = await getUnnotifiedWins(userId);
  if (wins.length === 0) return null;

  return <WinToastNotifier wins={wins} />;
}
