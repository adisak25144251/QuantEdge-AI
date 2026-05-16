import { handleUsStockScreener, type ApiRequest, type ApiResponse } from "../_marketData.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return handleUsStockScreener(req, res);
}
