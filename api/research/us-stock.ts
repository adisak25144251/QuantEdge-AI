import { handleUsStockResearch } from '../_researchData.js';
import type { ApiRequest, ApiResponse } from '../_marketData.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return handleUsStockResearch(req, res);
}
