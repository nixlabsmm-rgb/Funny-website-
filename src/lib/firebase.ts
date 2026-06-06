import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Standard validation check on boot as requested by skill
async function testConnection() {
  let retries = 3;
  while (retries > 0) {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      break; // Success or permission-denied means the backend is reachable
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        // A permission-denied error indicates successful contact with the Firestore backend rules engine
        if (msg.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('insufficient permissions')) {
          break;
        }
        // If it's code=unavailable/offline, retry gracefully
        if (msg.includes('unavailable') || msg.includes('offline') || msg.includes('could not reach')) {
          retries--;
          if (retries === 0) {
            console.warn("Please check your Firebase configuration. Firestore connection is currently unavailable.");
          } else {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
      }
      break;
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email || null,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
export { doc };
