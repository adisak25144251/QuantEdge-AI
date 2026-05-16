import { collection, doc, setDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { buildInstitutionalAuditArtifact, buildInstitutionalAuditPath, type InstitutionalAuditArtifactInput } from '../domain/audit/institutionalAuditPersistence';

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
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Interfaces match the Blueprint
export interface SetupData {
  id: string;
  symbol: string;
  userId: string;
  createdAt: number;
  setupPayload: string;
}

export interface JournalTradeData {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  status: string;
  createdAt: number;
  payload: string; // the full Trade object serialized
}

export interface ProfileConfig {
  userId: string;
  portfolioSize: number;
  riskPercent: number;
}

const withAccountEmail = (payloadJson: string) => {
  try {
    return JSON.stringify({
      ...JSON.parse(payloadJson),
      accountEmail: auth.currentUser?.email || null
    });
  } catch (_error) {
    return payloadJson;
  }
};

export const syncProfileToFirestore = async (portfolioSize: number, riskPercent: number) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const docRef = doc(db, 'users', uid, 'profile', 'config');
  try {
    await setDoc(docRef, {
      userId: uid,
      portfolioSize,
      riskPercent
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docRef.path);
  }
};

export const saveSetupToFirestore = async (setupData: Omit<SetupData, 'userId'>) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const docRef = doc(db, 'users', uid, 'setups', setupData.id);
  const setupPayload = withAccountEmail(setupData.setupPayload);
  try {
    await setDoc(docRef, {
      ...setupData,
      setupPayload,
      userId: uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docRef.path);
  }
};

export const deleteSetupFromFirestore = async (id: string) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const docRef = doc(db, 'users', uid, 'setups', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docRef.path);
  }
};

export const clearAllSetupsFromFirestore = async (setups: any[]) => {
  if (!auth.currentUser) return;
  // This is a naive clear without batch for simplicity, but preferably done securely
  for (const s of setups) {
    if (s.id) await deleteSetupFromFirestore(s.id);
  }
};

export const executeTradeInFirestore = async (trade: any) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const docRef = doc(db, 'users', uid, 'journal', trade.id);
  const payload = JSON.stringify({
    ...trade,
    accountEmail: auth.currentUser.email || null
  });
  try {
    await setDoc(docRef, {
      id: trade.id,
      userId: uid,
      symbol: trade.symbol,
      side: trade.side,
      status: trade.status,
      createdAt: Date.now(),
      payload
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docRef.path);
  }
};

export const updateTradeInFirestore = async (trade: any) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const docRef = doc(db, 'users', uid, 'journal', trade.id);
    const payload = JSON.stringify({
      ...trade,
      accountEmail: auth.currentUser.email || null
    });
    try {
      await updateDoc(docRef, {
        status: trade.status,
        payload
        // Note: Do not update createdAt per security rules
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docRef.path);
    }
};

export const saveInstitutionalAuditArtifactToFirestore = async (input: Omit<InstitutionalAuditArtifactInput, 'createdAt'> & { createdAt?: number }) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const artifact = buildInstitutionalAuditArtifact({
    ...input,
    createdAt: input.createdAt ?? Date.now()
  });
  const path = buildInstitutionalAuditPath(uid, artifact.kind, artifact.id);
  const docRef = doc(db, path);
  try {
    await setDoc(docRef, {
      ...artifact,
      userId: uid
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docRef.path);
  }
};
