import { HomeScreen } from "@/pages/home/HomeScreen";
import { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";
import "@/App.css";

export default function App() {
  const account = usePolarAccount();
  return <HomeScreen account={account} />;
}
