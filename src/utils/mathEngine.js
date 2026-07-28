/**
 * Mirepa Fund Modeling Math Engine — v2
 * Deal-level cash flow scheduling, dynamic AUM/NAV, staggered exits, true IRR.
 * Pure functions, no side effects.
 *
 * KEY CONCEPT: Everything is built around per-deal annual cash flow schedules.
 * These get aggregated into stream-level and fund-level annual cash flow arrays,
 * from which IRR is computed properly (not approximated).
 */

// ============================================================================
// 0. UTILITIES
// ============================================================================

/**
 * True IRR via Newton-Raphson on an array of annual cash flows.
 * flows[0] is year 0, flows[1] is year 1, etc. Negative = outflow, positive = inflow.
 */
export function calculateIRR(flows, guess = 0.15) {
  // Guard: no real investment or no real return
  const hasOutflow = flows.some((f) => f < 0);
  const hasInflow = flows.some((f) => f > 0);
  if (!hasOutflow || !hasInflow) return 0;

  let rate = guess;
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < flows.length; t++) {
      npv += flows[t] / Math.pow(1 + rate, t);
      dnpv += (-t * flows[t]) / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(npv) < 1) break; // converged (within $1)
    if (dnpv === 0) break;
    const newRate = rate - npv / dnpv;
    if (newRate <= -0.99) {
      rate = -0.5; // reset if diverging toward -100%
      continue;
    }
    rate = newRate;
  }
  return rate;
}

/** Merge a { year: amount } map into an existing map (adds values). */
function addCashFlow(map, year, amount) {
  map[year] = (map[year] || 0) + amount;
}

/** Convert a { year: amount } map into a dense array starting at year 0. */
function cashFlowMapToArray(map, fundLife) {
  const arr = new Array(fundLife + 1).fill(0); // years 0..fundLife inclusive
  Object.keys(map).forEach((yearStr) => {
    const year = Number(yearStr);
    if (year >= 0 && year <= fundLife) {
      arr[year] += map[year];
    } else if (year > fundLife) {
      // Exit tranches that spill past fund life still get counted at the final year
      // so cash isn't lost from the IRR calc.
      arr[fundLife] += map[year];
    }
  });
  return arr;
}

// ============================================================================
// 1. DEAL SCHEDULE GENERATION
// ============================================================================

/**
 * Spreads deals evenly across the investing period based on dealsPerYear,
 * up to totalDeals (or dealCap for WA). Any remainder is dumped in the final
 * investing year.
 */
export function generateDealSchedule(streamCapital, dealsPerYear, totalDeals, investingPeriod) {
  const deals = [];
  let dealsRemaining = totalDeals;
  let dealId = 1;

  for (let year = 1; year <= investingPeriod && dealsRemaining > 0; year++) {
    const isLastYear = year === investingPeriod;
    const dealsThisYear = isLastYear ? dealsRemaining : Math.min(dealsPerYear, dealsRemaining);
    for (let i = 0; i < dealsThisYear; i++) {
      deals.push({ dealId: `deal_${dealId}`, investmentYear: year });
      dealId++;
    }
    dealsRemaining -= dealsThisYear;
  }

  const avgDealSize = streamCapital / totalDeals;
  return deals.map((d) => ({ ...d, investedAmount: avgDealSize }));
}

/** Determines exit year for a deal based on stream-level exit configuration. */
function getExitYear(investmentYear, holdingYears, exitConfig) {
  if (exitConfig.exitTiming === 'fixedYear') {
    return exitConfig.fixedExitYear;
  }
  return investmentYear + holdingYears; // default: 'holding'
}

/** Returns the array of years over which an exit is tranched. */
function getTrancheYears(exitYear, tranches) {
  const count = Math.max(1, tranches || 1);
  return Array.from({ length: count }, (_, i) => exitYear + i);
}

// ============================================================================
// 2. US DEAL CASH FLOW BUILDER (Sponsored Search Structure)
// ============================================================================

/**
 * Builds the full annual cash flow schedule for a single US deal:
 * - Outflow at investment
 * - Annual cash interest on debt tranche during hold
 * - PIK capitalizes on debt, realized (with principal) at exit
 * - Preferred equity accrues (compound/simple), capitalized, realized at exit
 * - Voting shares realized at exit via MOIC
 * - Exit proceeds spread across tranche years per exitConfig
 */
export function buildUSDealCashFlows(deal, config, exitConfig) {
  const {
    holdingYearsMin = 4,
    holdingYearsMax = 6,
    equityMoic = 3.0,
    debtCashRate = 0.08,
    debtPikRate = 0.045,
    votingSharesRate = 0.09,
    prefEquityRate = 0.08,
    prefEquityMethod = 'compound',
    debtAllocation = 0.50,
    equityAllocation = 0.50,
  } = config;

  const invested = deal.investedAmount;
  const debtTranche = invested * debtAllocation;
  const equityTranche = invested * equityAllocation;
  const votingAmt = equityTranche * votingSharesRate;
  const prefAmt = equityTranche * (1 - votingSharesRate);

  const holdingYears = Math.round((holdingYearsMin + holdingYearsMax) / 2);
  const investmentYear = deal.investmentYear;
  const exitYear = getExitYear(investmentYear, holdingYears, exitConfig);
  const trancheYears = getTrancheYears(exitYear, exitConfig.tranches);

  const cashFlows = {};

  // Capital outflow at investment
  addCashFlow(cashFlows, investmentYear, -invested);

  // Annual cash interest on debt, paid each year during the hold
  const cashInterestPerYear = debtTranche * debtCashRate;
  for (let y = investmentYear + 1; y <= exitYear; y++) {
    addCashFlow(cashFlows, y, cashInterestPerYear);
  }

  // PIK capitalizes on the debt principal, realized at exit
  const pikAccrued = debtTranche * (Math.pow(1 + debtPikRate, holdingYears) - 1);
  const debtExitAmount = debtTranche + pikAccrued;

  // Preferred equity accrues and capitalizes, realized at exit
  const prefResult = compoundPreferredEquity(prefAmt, prefEquityRate, holdingYears, prefEquityMethod);
  const prefExitAmount = prefResult.totalAccrued;

  // Voting shares realized at exit via MOIC
  const votingExitAmount = votingAmt * equityMoic;

  const totalExitAmount = debtExitAmount + prefExitAmount + votingExitAmount;
  const perTranche = totalExitAmount / trancheYears.length;
  trancheYears.forEach((y) => addCashFlow(cashFlows, y, perTranche));

  return {
    dealId: deal.dealId,
    investmentYear,
    exitYear,
    holdingYears,
    invested,
    debtTranche,
    equityTranche,
    votingAmt,
    prefAmt,
    debtPikRate,
    prefEquityRate,
    prefEquityMethod,
    cashInterestPerYear,
    pikAccrued,
    debtExitAmount,
    prefExitAmount,
    votingExitAmount,
    totalExitAmount,
    trancheYears,
    cashFlows,
  };
}

// ============================================================================
// 3. WEST AFRICA DEAL CASH FLOW BUILDER
// ============================================================================

export function buildWADealCashFlows(deal, config, exitConfig) {
  const {
    holdingYearsMin = 4,
    holdingYearsMax = 6,
    baseMoic = 2.0,
    debtAllocation = 0.70,
    equityAllocation = 0.30,
  } = config;

  const invested = deal.investedAmount;
  const debtTranche = invested * debtAllocation;
  const equityTranche = invested * equityAllocation;

  const holdingYears = Math.round((holdingYearsMin + holdingYearsMax) / 2);
  const investmentYear = deal.investmentYear;
  const exitYear = getExitYear(investmentYear, holdingYears, exitConfig);
  const trancheYears = getTrancheYears(exitYear, exitConfig.tranches);

  const cashFlows = {};
  addCashFlow(cashFlows, investmentYear, -invested);

  // Simplified: whole deal exits at baseMoic (no interim cash yield modeled for WA yet)
  const totalExitAmount = invested * baseMoic;
  const perTranche = totalExitAmount / trancheYears.length;
  trancheYears.forEach((y) => addCashFlow(cashFlows, y, perTranche));

  return {
    dealId: deal.dealId,
    investmentYear,
    exitYear,
    holdingYears,
    invested,
    debtTranche,
    equityTranche,
    totalExitAmount,
    trancheYears,
    cashFlows,
  };
}

// ============================================================================
// 4. PREFERRED EQUITY / DEBT COMPOUNDING HELPERS (unchanged math, still used)
// ============================================================================

export function compoundDebtInterest(principal, totalRate, cashRate, pikRate, holdingYears) {
  const cashInterestPerYear = principal * cashRate;
  const totalCashInterest = cashInterestPerYear * holdingYears;
  const pikInterestAccrued = principal * (Math.pow(1 + pikRate, holdingYears) - 1);
  const totalAtExit = principal + totalCashInterest + pikInterestAccrued;
  return { principal, cashInterestPerYear, totalCashInterest, pikInterestAccrued, totalAtExit, totalRate };
}

export function compoundPreferredEquity(principal, rate, holdingYears, compoundMethod = 'compound') {
  let totalAccrued = 0;
  if (compoundMethod === 'compound') {
    totalAccrued = principal * Math.pow(1 + rate, holdingYears);
  } else {
    totalAccrued = principal * (1 + rate * holdingYears);
  }
  return { principal, rate, holdingYears, compoundMethod, totalAccrued, interestGenerated: totalAccrued - principal };
}

/** Unrealized (mark-to-model) value of a deal at a given year, before exit. */
function getDealUnrealizedValue(dealCF, year, stream) {
  if (year < dealCF.investmentYear || year >= dealCF.exitYear) return 0;
  const yearsHeld = year - dealCF.investmentYear;

  if (stream === 'us') {
    const debtUnrealized = dealCF.debtTranche * Math.pow(1 + dealCF.debtPikRate, yearsHeld);
    const prefUnrealized = compoundPreferredEquity(
      dealCF.prefAmt,
      dealCF.prefEquityRate,
      yearsHeld,
      dealCF.prefEquityMethod
    ).totalAccrued;
    // Voting equity marked straight-line toward its exit value (simplification)
    const votingUnrealized =
      dealCF.votingAmt + (dealCF.votingExitAmount - dealCF.votingAmt) * (yearsHeld / dealCF.holdingYears);
    return debtUnrealized + prefUnrealized + votingUnrealized;
  } else {
    // WA: straight-line mark toward exit value (no interim structure modeled yet)
    return dealCF.invested + (dealCF.totalExitAmount - dealCF.invested) * (yearsHeld / dealCF.holdingYears);
  }
}

// ============================================================================
// 5. FUND FEES (with real AUM-vs-committed base selection)
// ============================================================================

/**
 * Computes fund fees year-by-year. If a fee's base is 'aum', it uses the
 * AUM schedule you pass in (see calculateAUMSchedule). If 'committed', uses
 * flat fundSize.
 *
 * NOTE: Because AUM depends on deployment, and deployment sizing depends on
 * investible capital (which depends on fees), this function is designed to be
 * called TWICE: once with aumSchedule=null (to get a first-pass investible
 * capital for deal sizing), and again with the real aumSchedule (to get
 * accurate reported fees). See calculateCompleteFundModel for the orchestration.
 */
export function calculateFundFees(fundConfig, aumSchedule = null) {
  const {
    fundSize = 50000000,
    fundLife = 10,
    mgtFeeRate = 0.02,
    mgtFeeBase = 'committed',
    stepDownActive = false,
    stepDownRate = 0.015,
    stepDownBase = 'committed',
    stepDownStartYear = 6,
    orgFeeRate = 0.01,
    orgFeeBase = 'committed',
    opexYears1to5Rate = 0.005,
    opexYears1to5Base = 'committed',
    opexYears6to10Rate = 0.005,
    opexYears6to10Base = 'committed',
  } = fundConfig;

  const getBase = (basePref, year) => {
    if (basePref === 'aum' && aumSchedule) return Math.max(0, aumSchedule[year] || 0);
    return fundSize; // committed capital, or fallback if no AUM schedule yet
  };

  const yearlyMgtFees = [];
  const yearlyOpex = [];
  let totalMgtFees = 0;
  let totalOpex = 0;

  // Org fee charged at year 0 (fund close), before any deployment
  const orgFeeBaseAmount = orgFeeBase === 'aum' ? (aumSchedule ? aumSchedule[0] || 0 : 0) : fundSize;
  const orgFee = orgFeeBaseAmount * orgFeeRate;

  for (let year = 1; year <= fundLife; year++) {
    let mgtFeeForYear;
    if (year < stepDownStartYear || !stepDownActive) {
      mgtFeeForYear = getBase(mgtFeeBase, year) * mgtFeeRate;
    } else {
      mgtFeeForYear = getBase(stepDownBase, year) * stepDownRate;
    }
    yearlyMgtFees.push(mgtFeeForYear);
    totalMgtFees += mgtFeeForYear;

    let opexForYear;
    if (year <= 5) {
      opexForYear = getBase(opexYears1to5Base, year) * opexYears1to5Rate;
    } else {
      opexForYear = getBase(opexYears6to10Base, year) * opexYears6to10Rate;
    }
    yearlyOpex.push(opexForYear);
    totalOpex += opexForYear;
  }

  const totalFees = totalMgtFees + orgFee + totalOpex;
  const investibleCapital = fundSize - totalFees;

  return {
    fundSize,
    fundLife,
    yearlyMgtFees,
    yearlyOpex,
    totalMgtFees,
    totalOrgFee: orgFee,
    totalOpex,
    totalFees,
    investibleCapital,
    feeBreakdown: { mgtFees: totalMgtFees, orgFee, opex: totalOpex },
  };
}

// ============================================================================
// 6. STREAM-LEVEL AGGREGATION (deals -> cash flows -> IRR/DPI)
// ============================================================================

export function calculateUSStreamReturns(streamCapital, config, fundLife) {
  const { dealsPerYear = 2, totalDeals = 5, investingPeriod = 5 } = config;
  const exitConfig = config.exitConfig || { exitTiming: 'holding', tranches: 1, fixedExitYear: null };

  const deals = generateDealSchedule(streamCapital, dealsPerYear, totalDeals, investingPeriod);
  const dealCashFlows = deals.map((d) => buildUSDealCashFlows(d, config, exitConfig));

  const combinedMap = {};
  dealCashFlows.forEach((dcf) => {
    Object.keys(dcf.cashFlows).forEach((y) => addCashFlow(combinedMap, Number(y), dcf.cashFlows[y]));
  });

  const flowArray = cashFlowMapToArray(combinedMap, fundLife);
  const irr = calculateIRR(flowArray);

  const totalInvested = streamCapital;
  const totalGrossProceeds = dealCashFlows.reduce((sum, d) => sum + d.totalExitAmount, 0) +
    dealCashFlows.reduce((sum, d) => sum + d.cashInterestPerYear * (d.exitYear - d.investmentYear), 0);
  const dpi = totalGrossProceeds / totalInvested;

  // Average per-deal figures for display
  const avgDealSize = streamCapital / totalDeals;

  return {
    dealCount: totalDeals,
    avgDealSize,
    holdingYears: dealCashFlows[0]?.holdingYears || 0,
    totalInvested,
    totalGrossProceeds,
    grossIRR: irr,
    netIRR: irr, // fund-level waterfall applies carry separately
    dpi,
    moic: dpi,
    deals: dealCashFlows,
    cashFlowMap: combinedMap,
    perDealMetrics: dealCashFlows[0]
      ? {
          debtReturns: dealCashFlows[0].debtExitAmount,
          equityReturns: dealCashFlows[0].prefExitAmount + dealCashFlows[0].votingExitAmount,
          totalProceeds: dealCashFlows[0].totalExitAmount,
          dealMoic: dealCashFlows[0].totalExitAmount / dealCashFlows[0].invested,
        }
      : null,
    searcherEconomics: calculateSearcherEconomics(dealCashFlows, config),
  };
}

function calculateSearcherEconomics(dealCashFlows, config) {
  const {
    searcherEquityAlloc = 0.01,
    searcherDebtEconomics = 'option1',
    searcherCarryThreshold = 3.0,
    searcherCarryBelow = 0.075,
    searcherCarryAbove = 0.10,
    equityMoic = 3.0,
  } = config;

  if (dealCashFlows.length === 0) return null;

  const totalEquityInvested = dealCashFlows.reduce((s, d) => s + d.equityTranche, 0);
  const totalDebtInvested = dealCashFlows.reduce((s, d) => s + d.debtTranche, 0);
  const avgHoldingYears = dealCashFlows.reduce((s, d) => s + d.holdingYears, 0) / dealCashFlows.length;

  const equityValue = totalEquityInvested * searcherEquityAlloc;

  let debtEconomicValue = 0;
  if (searcherDebtEconomics === 'option1') {
    debtEconomicValue = totalDebtInvested * 0.01 * avgHoldingYears;
  } else if (searcherDebtEconomics === 'option2') {
    debtEconomicValue = totalDebtInvested * 0.005 * avgHoldingYears * 2;
  }
  // option3: billed to fund expenses, not paid to searcher directly

  const carryRate = equityMoic >= searcherCarryThreshold ? searcherCarryAbove : searcherCarryBelow;

  return {
    equityAllocPercent: searcherEquityAlloc,
    equityValue,
    debtEconomics: searcherDebtEconomics,
    debtEconomicValue,
    carryRate,
    carryThreshold: searcherCarryThreshold,
  };
}

export function calculateWAStreamReturns(streamCapital, config, fundLife) {
  const { dealsPerYear = 2, dealCap = 6, investingPeriod = 5 } = config;
  const exitConfig = config.exitConfig || { exitTiming: 'holding', tranches: 1, fixedExitYear: null };

  const deals = generateDealSchedule(streamCapital, dealsPerYear, dealCap, investingPeriod);
  const dealCashFlows = deals.map((d) => buildWADealCashFlows(d, config, exitConfig));

  const combinedMap = {};
  dealCashFlows.forEach((dcf) => {
    Object.keys(dcf.cashFlows).forEach((y) => addCashFlow(combinedMap, Number(y), dcf.cashFlows[y]));
  });

  const flowArray = cashFlowMapToArray(combinedMap, fundLife);
  const irr = calculateIRR(flowArray);

  const totalInvested = streamCapital;
  const totalGrossProceeds = dealCashFlows.reduce((sum, d) => sum + d.totalExitAmount, 0);
  const dpi = totalGrossProceeds / totalInvested;
  const avgDealSize = streamCapital / dealCap;

  return {
    dealCount: dealCap,
    avgDealSize,
    holdingYears: dealCashFlows[0]?.holdingYears || 0,
    totalInvested,
    totalGrossProceeds,
    grossIRR: irr,
    netIRR: irr,
    dpi,
    moic: dpi,
    baseMoic: config.baseMoic,
    deals: dealCashFlows,
    cashFlowMap: combinedMap,
    perDealMetrics: dealCashFlows[0]
      ? {
          debtTranche: dealCashFlows[0].debtTranche,
          equityTranche: dealCashFlows[0].equityTranche,
          dealMoic: dealCashFlows[0].totalExitAmount / dealCashFlows[0].invested,
        }
      : null,
  };
}

// ============================================================================
// 7. AUM / NAV SCHEDULE
// AUM(year) = cumulative invested - cumulative distributed + unrealized FV - write-offs
// ============================================================================

export function calculateAUMSchedule(usReturns, waReturns, fundLife, writeOffsByYear = {}) {
  const aumSchedule = new Array(fundLife + 1).fill(0);

  const allDeals = [
    ...usReturns.deals.map((d) => ({ ...d, stream: 'us' })),
    ...waReturns.deals.map((d) => ({ ...d, stream: 'wa' })),
  ];

  let cumulativeInvested = 0;
  let cumulativeDistributed = 0;
  let cumulativeWriteOffs = 0;

  for (let year = 0; year <= fundLife; year++) {
    // Capital invested this year, across both streams
    const investedThisYear = allDeals
      .filter((d) => d.investmentYear === year)
      .reduce((s, d) => s + d.invested, 0);
    cumulativeInvested += investedThisYear;

    // Cash distributed this year (positive cash flow entries only)
    const distributedThisYear = allDeals.reduce((sum, d) => sum + (d.cashFlows[year] > 0 ? d.cashFlows[year] : 0), 0);
    cumulativeDistributed += distributedThisYear;

    cumulativeWriteOffs += writeOffsByYear[year] || 0;

    // Unrealized fair value of deals still held
    const unrealizedFV = allDeals.reduce((sum, d) => sum + getDealUnrealizedValue(d, year, d.stream), 0);

    aumSchedule[year] = Math.max(0, cumulativeInvested - cumulativeDistributed + unrealizedFV - cumulativeWriteOffs);
  }

  return aumSchedule;
}

// ============================================================================
// 8. FUND-LEVEL WATERFALL
// ============================================================================

export function calculateFundWaterfall(usStreamReturns, waStreamReturns, fundConfig, feeResult) {
  const { hurdle = 0.06, carry = 0.20, fundSize = 50000000, fundLife = 10 } = fundConfig;

  const usProceeds = usStreamReturns.totalGrossProceeds;
  const waProceeds = waStreamReturns.totalGrossProceeds;
  const totalGrossProceeds = usProceeds + waProceeds;
  const totalInvested = fundSize;

  const gainAboveCapital = Math.max(0, totalGrossProceeds - totalInvested);
  const hurdleReturn = totalInvested * hurdle;
  const excessAboveHurdle = Math.max(0, gainAboveCapital - hurdleReturn);
  const gpCarry = excessAboveHurdle * carry;
  const lpShare = totalGrossProceeds - gpCarry - (feeResult ? feeResult.totalFees : 0);

  // Combine US + WA annual cash flow maps into one fund-level array for true fund IRR
  const combinedMap = {};
  Object.keys(usStreamReturns.cashFlowMap).forEach((y) =>
    addCashFlow(combinedMap, Number(y), usStreamReturns.cashFlowMap[y])
  );
  Object.keys(waStreamReturns.cashFlowMap).forEach((y) =>
    addCashFlow(combinedMap, Number(y), waStreamReturns.cashFlowMap[y])
  );
  const flowArray = cashFlowMapToArray(combinedMap, fundLife);
  const fundIRR = calculateIRR(flowArray);

  const fundDPI = totalGrossProceeds / totalInvested;

  return {
    totalGrossProceeds,
    returnOfCapital: Math.min(totalGrossProceeds, totalInvested),
    gainAboveCapital,
    hurdleReturn,
    excessAboveHurdle,
    lpShare,
    gpCarry,
    gpCarryPercentage: carry,
    dpi: fundDPI,
    irr: fundIRR,
    grossIRR: fundIRR,
    netIRR: fundIRR,
    combinedCashFlowMap: combinedMap,
    usContribution: { proceeds: usProceeds, dpi: usStreamReturns.dpi, irr: usStreamReturns.grossIRR },
    waContribution: { proceeds: waProceeds, dpi: waStreamReturns.dpi, irr: waStreamReturns.grossIRR },
  };
}

// ============================================================================
// 9. COMPLETE MODEL ORCHESTRATION (handles the fee/AUM two-pass approach)
// ============================================================================

export function calculateCompleteFundModel(fundConfig, usConfig, waConfig) {
  const fundLife = fundConfig.fundLife || 10;

  // PASS 1: size deployment using committed-capital-based investible capital
  const firstPassFees = calculateFundFees(fundConfig, null);
  const investibleCapital = firstPassFees.investibleCapital;

  const usAllocation = usConfig.streamAllocationPct || 0.40;
  const waAllocation = waConfig.streamAllocationPct || 0.60;
  const usStreamCapital = investibleCapital * usAllocation;
  const waStreamCapital = investibleCapital * waAllocation;

  // Build deal schedules & stream returns (this fixes deal sizes/timing)
  const usReturns = calculateUSStreamReturns(usStreamCapital, usConfig, fundLife);
  const waReturns = calculateWAStreamReturns(waStreamCapital, waConfig, fundLife);

  // Build AUM schedule from the actual deal cash flows
  const aumSchedule = calculateAUMSchedule(usReturns, waReturns, fundLife);

  // PASS 2: recompute fees using the real AUM schedule for accurate reporting
  const feeResult = calculateFundFees(fundConfig, aumSchedule);

  // Fund waterfall using true cash-flow-based IRR
  const waterfall = calculateFundWaterfall(usReturns, waReturns, fundConfig, feeResult);

  return {
    feeAnalysis: feeResult,
    aumSchedule,
    usStream: usReturns,
    waStream: waReturns,
    fundWaterfall: waterfall,
    summary: {
      fundSize: fundConfig.fundSize,
      totalFees: feeResult.totalFees,
      investibleCapital: feeResult.investibleCapital,
      usCapital: usStreamCapital,
      waCapital: waStreamCapital,
      totalGrossProceeds: waterfall.totalGrossProceeds,
      grossIRR: waterfall.grossIRR,
      fundDPI: waterfall.dpi,
      gpCarry: waterfall.gpCarry,
      lpDistributions: waterfall.lpShare,
      finalAUM: aumSchedule[aumSchedule.length - 1],
    },
  };
}

// ============================================================================
// 10. TEST FUNCTION
// ============================================================================

export function testMathEngine() {
  console.log('=== TESTING MATH ENGINE v2 ===\n');

  const fundConfig = {
    fundSize: 50000000,
    fundLife: 10,
    mgtFeeRate: 0.02,
    mgtFeeBase: 'committed',
    orgFeeRate: 0.01,
    orgFeeBase: 'committed',
    opexYears1to5Rate: 0.005,
    opexYears6to10Rate: 0.005,
    hurdle: 0.06,
    carry: 0.20,
  };

  const usConfig = {
    streamAllocationPct: 0.40,
    dealsPerYear: 2,
    totalDeals: 5,
    investingPeriod: 5,
    holdingYearsMin: 4,
    holdingYearsMax: 6,
    equityMoic: 3.0,
    debtAllocation: 0.50,
    equityAllocation: 0.50,
    debtCashRate: 0.08,
    debtPikRate: 0.045,
    votingSharesRate: 0.09,
    prefEquityRate: 0.08,
    prefEquityMethod: 'compound',
    searcherEquityAlloc: 0.01,
    searcherDebtEconomics: 'option1',
    searcherCarryThreshold: 3.0,
    searcherCarryBelow: 0.075,
    searcherCarryAbove: 0.10,
    exitConfig: { exitTiming: 'holding', tranches: 1, fixedExitYear: null },
  };

  const waConfig = {
    streamAllocationPct: 0.60,
    dealsPerYear: 2,
    dealCap: 6,
    investingPeriod: 5,
    holdingYearsMin: 4,
    holdingYearsMax: 6,
    baseMoic: 2.0,
    debtAllocation: 0.70,
    equityAllocation: 0.30,
    exitConfig: { exitTiming: 'holding', tranches: 1, fixedExitYear: null },
  };

  const model = calculateCompleteFundModel(fundConfig, usConfig, waConfig);

  console.log(`Investible Capital: $${(model.summary.investibleCapital / 1e6).toFixed(2)}M`);
  console.log(`US Capital: $${(model.summary.usCapital / 1e6).toFixed(2)}M`);
  console.log(`WA Capital: $${(model.summary.waCapital / 1e6).toFixed(2)}M\n`);

  console.log(`US Stream DPI: ${model.usStream.dpi.toFixed(2)}x, IRR: ${(model.usStream.grossIRR * 100).toFixed(1)}%`);
  console.log(`WA Stream DPI: ${model.waStream.dpi.toFixed(2)}x, IRR: ${(model.waStream.grossIRR * 100).toFixed(1)}%\n`);

  console.log(`Fund DPI: ${model.summary.fundDPI.toFixed(2)}x`);
  console.log(`Fund Gross IRR: ${(model.summary.grossIRR * 100).toFixed(1)}%`);
  console.log(`GP Carry: $${(model.summary.gpCarry / 1e6).toFixed(2)}M`);
  console.log(`Final AUM (year ${fundConfig.fundLife}): $${(model.summary.finalAUM / 1e6).toFixed(2)}M\n`);

  console.log('AUM Schedule by year:');
  model.aumSchedule.forEach((v, y) => console.log(`  Year ${y}: $${(v / 1e6).toFixed(2)}M`));

  console.log('\n=== TESTS COMPLETE ===');
}
