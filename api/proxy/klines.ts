import { handleKlines, type ApiRequest, type ApiResponse } from "../_marketData";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return handleKlines(req, res);
}
