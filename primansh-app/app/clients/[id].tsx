import { useLocalSearchParams } from 'expo-router';
import ClientDetailScreen from '../../components/clients/ClientDetailScreen';

export default function ClientDetailRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!clientId) {
    return null;
  }

  return <ClientDetailScreen clientId={clientId} />;
}
