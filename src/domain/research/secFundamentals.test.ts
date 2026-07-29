import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSecFundamentalSnapshot } from './secFundamentals';

const annual = (val: number, start: string, end: string, filed: string, accn: string) => ({
  val,
  start,
  end,
  filed,
  form: '10-K',
  accn
});

test('buildSecFundamentalSnapshot derives comparable annual metrics with provenance', () => {
  const result = buildSecFundamentalSnapshot({
    cik: 1234,
    facts: {
      'us-gaap': {
        Revenues: { units: { USD: [
          annual(100, '2023-01-01', '2023-12-31', '2024-02-15', '0001-24-000001'),
          annual(125, '2024-01-01', '2024-12-31', '2025-02-15', '0001-25-000001')
        ] } },
        GrossProfit: { units: { USD: [
          annual(40, '2023-01-01', '2023-12-31', '2024-02-15', '0001-24-000001'),
          annual(55, '2024-01-01', '2024-12-31', '2025-02-15', '0001-25-000001')
        ] } },
        NetIncomeLoss: { units: { USD: [
          annual(-10, '2023-01-01', '2023-12-31', '2024-02-15', '0001-24-000001'),
          annual(5, '2024-01-01', '2024-12-31', '2025-02-15', '0001-25-000001')
        ] } },
        NetCashProvidedByUsedInOperatingActivities: { units: { USD: [
          annual(20, '2024-01-01', '2024-12-31', '2025-02-15', '0001-25-000001')
        ] } },
        PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [
          annual(8, '2024-01-01', '2024-12-31', '2025-02-15', '0001-25-000001')
        ] } },
        CashAndCashEquivalentsAtCarryingValue: { units: { USD: [
          { val: 30, end: '2024-12-31', filed: '2025-02-15', form: '10-K', accn: '0001-25-000001' }
        ] } },
        LongTermDebt: { units: { USD: [
          { val: 20, end: '2024-12-31', filed: '2025-02-15', form: '10-K', accn: '0001-25-000001' }
        ] } },
        CommonStockSharesOutstanding: { units: { shares: [
          { val: 10, end: '2025-02-01', filed: '2025-02-15', form: '10-K', accn: '0001-25-000001' }
        ] } },
        WeightedAverageNumberOfSharesOutstandingBasic: { units: { shares: [
          annual(9, '2024-01-01', '2024-12-31', '2025-02-15', '0001-25-000001')
        ] } }
      }
    }
  });

  assert.equal(result.revenue.value, 125);
  assert.equal(result.revenueGrowthPercent.value, 25);
  assert.equal(result.grossMarginPercent.value, 44);
  assert.equal(result.grossMarginTrend, 'EXPANDING');
  assert.equal(result.freeCashFlow.value, 12);
  assert.equal(result.earningsTrend, 'IMPROVING');
  assert.equal(result.cashDebtProfile, 'NET_CASH');
  assert.equal(result.weightedAverageShares.value, 9);
  assert.equal(result.status, 'VERIFIED');
  assert.match(result.revenue.sourceUrl ?? '', /sec\.gov\/Archives/);
});

test('buildSecFundamentalSnapshot preserves Data required when comparable facts are absent', () => {
  const result = buildSecFundamentalSnapshot({ facts: {} });
  assert.equal(result.status, 'DATA_REQUIRED');
  assert.equal(result.revenueGrowthPercent.value, null);
  assert.equal(result.grossMarginTrend, 'UNKNOWN');
  assert.equal(result.freeCashFlow.value, null);
});
