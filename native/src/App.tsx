import { HomeScreen } from "@/pages/home/HomeScreen";
import { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";
import { OnboardingScreen } from "@/pages/onboarding/OnboardingScreen";
import "@/App.css";

export default function App() {
  const account = usePolarAccount();
  return account.status.authenticated && account.status.selectedWorkspaceId ? (
    <HomeScreen account={account} />
  ) : (
    <OnboardingScreen account={account} />
  );
}
