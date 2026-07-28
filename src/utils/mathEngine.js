/**
 * Mirepa Fund Modeling Math Engine — v3
 * Deal-level cash flow scheduling, dynamic AUM/NAV, staggered exits, true IRR,
 * connected debt total/cash/PIK rates, and annual schedule table generation.
 */

// ============================================================================
// 0. UTILITIES
// ============================================================================

export function calculateIRR(flows, guess = 0.15) {
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
    if (Math.abs(npv) < 1) break;
    if (dnpv === 0) break;
    const newRate = rate - npv / dnpv;
    if (newRate <= -0.99) {
      rate = -0.5;
      continue;
    }
    rate = newRate;
  }
  return rate;
}

function addCashFlow(map, year, amount) {
  map[year] = (map[year] || 0) + amount;
}

function cashFlowMapToArray(map, fundLife) {
  const arr = new Array(fundLife + 1).fill(0);
  Object.keys(map).forEach((yearStr) => {
    const year = Number(yearStr);
    if (year >= 0 && year <= fundLife) {
      arr[year] += map[year];
    } else if (year > fundLife) {
      arr[fundLife] += map[year];
    }
  });
  return arr;
}

// ============================================================================
// 1. DEAL SCHEDULE GENERATION
// ============================================================================

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

function getExitYear(investmentYear, holdingYears, exitConfig) {
  if (exitConfig && exitConfig.exitTiming === 'fixedYear') {
    return exitConfig.fixedExitYear;
  }
  return investmentYear + holdingYears;
}

function getTrancheYears(exitYear, tranches) {
  const count = Math.max(1, tranches || 1);
  return Array.from({ length: count }, (_, i) => exitYear + i);
}

// ============================================================================
// 2. US DEAL CASH FLOW BUILDER
// Debt is now specified as TOTAL rate + CASH rate; PIK = total - cash.
// ============================================================================

export function buildUSDealCashFlows(deal, config, exitConfig) {
  const {
    holdingYearsMin = 4,
    holdingYearsMax = 6,
    equityMoic = 3.0,
    debtTotalRate = 0.125,
    debtCashRate = 0.08,
    votingSharesRate = 0.09,
    prefEquityRate = 0.08,
    prefEquityMethod = 'compound',
    debtAllocation = 0.50,
    equityAllocation = 0.50,
  } = config;

  // PIK is derived — never set directly. Clamp at 0 so an invalid cash rate
  // (higher than total) doesn't produce negative PIK.
  const debtPikRate = Math.max(0, debtTotalRate - debtCashRate);

  const invested = deal.investedAmount;
  const debtTranche = invested * debtAllocation;
  const equityTranche = invested * equityAllocation;
  const votingAmt = equityTranche * votingSharesRate;
  const prefAmt = equityTranche * (1 - votingSharesRate);

  const holdingYears = Math.round((holdingYearsMin + holdingYearsMax) / 2);
  const investmentYear = deal.investmentYear;
  const exitYear = getExitYear(investmentYear, holdingYears, exitConfig);
  const trancheYears = getTrancheYears(exitYear, exitConfig?.tranches);

  const cashFlows = {};
  addCashFlow(cashFlows, investmentYear, -invested);

  const cashInterestPerYear = debtTranche * debtCashRate;
  for (let y = investmentYear + 1; y <= exitYear; y++) {
    addCashFlow(cashFlows, y, cashInterestPerYear);
  }

  const pikAccrued = debtTranche * (Math.pow(1 + debtPikRate, holdingYears) - 1);
  const debtExitAmount = debtTranche + pikAccrued;

  const prefResult = compoundPreferredEquity(prefAmt, prefEquityRate, holdingYears, prefEquityMethod);
  const prefExitAmount = prefResult.totalAccrued;

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
    debtTotalRate,
    debtCashRate,
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
  const trancheYears = getTrancheYears(exitYear, exitConfig?.tranches);

  const cashFlows = {};
  addCashFlow(cashFlows, investmentYear, -invested);

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
// 4. COMPOUNDING HELPERS
// ============================================================================

export function compoundDebtInterest(principal, totalRate, cashRate, holdingYears) {
  const pikRate = Math.max(0, totalRate - cashRate);
  const cashInterestPerYear = principal * cashRate;
  const totalCashInterest = cashInterestPerYear * holdingYears;
  const pikInterestAccrued = principal * (Math.pow(1 + pikRate, holdingYears) - 1);
  const totalAtExit = principal + totalCashInterest + pikInterestAccrued;
  return { principal, cashInterestPerYear, totalCashInterest, pikInterestAccrued, totalAtExit, totalRate, pikRate };
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

export function getDealUnrealizedValue(dealCF, year, stream) {
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
    const votingUnrealized =
      dealCF.votingAmt + (dealCF.votingExitAmount - dealCF.votingAmt) * (yearsHeld / dealCF.holdingYears);
    return debtUnrealized + prefUnrealized + votingUnrealized;
  } else {
    return dealCF.invested + (dealCF.totalExitAmount - dealCF.invested) * (yearsHeld / dealCF.holdingYears);
  }
}

// ============================================================================
// 5. FUND FEES
// ============================================================================

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
    return fundSize;
  };

  const yearlyMgtFees = [];
  const yearlyOpex = [];
  let totalMgtFees = 0;
  let totalOpex = 0;

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
// 6. STREAM-LEVEL AGGREGATION
// ============================================================================

export function calculateUSStreamReturns(streamCapital, config, fundLife, exitConfig) {
  const { dealsPerYear = 2, totalDeals = 5, investingPeriod = 5 } = config;
  const effectiveExitConfig = exitConfig || config.exitConfig || { exitTiming: 'holding', tranches: 1, fixedExitYear: null };

  const deals = generateDealSchedule(streamCapital, dealsPerYear, totalDeals, investingPeriod);
  const dealCashFlows = deals.map((d) => buildUSDealCashFlows(d, config, effectiveExitConfig));

  const combinedMap = {};
  dealCashFlows.forEach((dcf) => {
    Object.keys(dcf.cashFlows).forEach((y) => addCashFlow(combinedMap, Number(y), dcf.cashFlows[y]));
  });

  const flowArray = cashFlowMapToArray(combinedMap, fundLife);
  const irr = calculateIRR(flowArray);

  const totalInvested = streamCapital;
  const totalGrossProceeds =
    dealCashFlows.reduce((sum, d) => sum + d.totalExitAmount, 0) +
    dealCashFlows.reduce((sum, d) => sum + d.cashInterestPerYear * (d.exitYear - d.investmentYear), 0);
  const dpi = totalGrossProceeds / totalInvested;
  const avgDealSize = streamCapital / totalDeals;

  return {
    dealCount: totalDeals,
    avgDealSize,
    holdingYears: dealCashFlows[0]?.holdingYears || 0,
    totalInvested,
    totalGrossProceeds,
    grossIRR: irr,
    netIRR: irr,
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

export function calculateWAStreamReturns(streamCapital, config, fundLife, exitConfig) {
  const { dealsPerYear = 2, dealCap = 6, investingPeriod = 5 } = config;
  const effectiveExitConfig = exitConfig || config.exitConfig || { exitTiming: 'holding', tranches: 1, fixedExitYear: null };

  const deals = generateDealSchedule(streamCapital, dealsPerYear, dealCap, investingPeriod);
  const dealCashFlows = deals.map((d) => buildWADealCashFlows(d, config, effectiveExitConfig));

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
    const investedThisYear = allDeals
      .filter((d) => d.investmentYear === year)
      .reduce((s, d) => s + d.invested, 0);
    cumulativeInvested += investedThisYear;

    const distributedThisYear = allDeals.reduce((sum, d) => sum + (d.cashFlows[year] > 0 ? d.cashFlows[year] : 0), 0);
    cumulativeDistributed += distributedThisYear;

    cumulativeWriteOffs += writeOffsByYear[year] || 0;

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
// 9. ANNUAL SCHEDULE TABLE (powers the "Fund Model" LP-facing view)
// ============================================================================

export function buildFundScheduleTable(usReturns, waReturns, feeResult, aumSchedule, fundLife) {
  const allDeals = [
    ...usReturns.deals.map((d) => ({ ...d, stream: 'us' })),
    ...waReturns.deals.map((d) => ({ ...d, stream: 'wa' })),
  ];

  const rows = [];
  let cumulativeCapitalDeployed = 0;
  let cumulativeDistributions = 0;
  let cumulativeFees = 0;

  for (let year = 0; year <= fundLife; year++) {
    const usCapitalDeployed = usReturns.deals
      .filter((d) => d.investmentYear === year)
      .reduce((s, d) => s + d.invested, 0);
    const waCapitalDeployed = waReturns.deals
      .filter((d) => d.investmentYear === year)
      .reduce((s, d) => s + d.invested, 0);
    const capitalDeployed = usCapitalDeployed + waCapitalDeployed;
    cumulativeCapitalDeployed += capitalDeployed;

    const mgtFee = year >= 1 ? feeResult.yearlyMgtFees[year - 1] : 0;
    const opex = year >= 1 ? feeResult.yearlyOpex[year - 1] : 0;
    const orgFee = year === 0 ? feeResult.totalOrgFee : 0;
    const feesThisYear = mgtFee + opex + orgFee;
    cumulativeFees += feesThisYear;

    const usDistributions = usReturns.deals.reduce((s, d) => s + (d.cashFlows[year] > 0 ? d.cashFlows[year] : 0), 0);
    const waDistributions = waReturns.deals.reduce((s, d) => s + (d.cashFlows[year] > 0 ? d.cashFlows[year] : 0), 0);
    const distributions = usDistributions + waDistributions;
    cumulativeDistributions += distributions;

    const unrealizedFV = allDeals.reduce((sum, d) => sum + getDealUnrealizedValue(d, year, d.stream), 0);

    rows.push({
      year,
      usCapitalDeployed,
      waCapitalDeployed,
      capitalDeployed,
      cumulativeCapitalDeployed,
      mgtFee,
      opex,
      orgFee,
      feesThisYear,
      cumulativeFees,
      usDistributions,
      waDistributions,
      distributions,
      cumulativeDistributions,
      unrealizedFV,
      runningAUM: aumSchedule[year],
      netCashFlow: distributions - capitalDeployed - feesThisYear,
    });
  }

  return rows;
}

// ============================================================================
// 10. COMPLETE MODEL ORCHESTRATION
// ============================================================================

export function calculateCompleteFundModel(fundConfig, usConfig, waConfig) {
  const fundLife = fundConfig.fundLife || 10;

  const globalExitConfig = {
    exitTiming: fundConfig.exitTiming || 'holding',
    fixedExitYear: fundConfig.fixedExitYear || null,
    tranches: fundConfig.exitTranches || 1,
  };

  const firstPassFees = calculateFundFees(fundConfig, null);
  const investibleCapital = firstPassFees.investibleCapital;

  const usAllocation = usConfig.streamAllocationPct || 0.40;
  const waAllocation = waConfig.streamAllocationPct || 0.60;
  const usStreamCapital = investibleCapital * usAllocation;
  const waStreamCapital = investibleCapital * waAllocation;

  const usReturns = calculateUSStreamReturns(usStreamCapital, usConfig, fundLife, globalExitConfig);
  const waReturns = calculateWAStreamReturns(waStreamCapital, waConfig, fundLife, globalExitConfig);

  const aumSchedule = calculateAUMSchedule(usReturns, waReturns, fundLife);
  const feeResult = calculateFundFees(fundConfig, aumSchedule);

  const waterfall = calculateFundWaterfall(usReturns, waReturns, fundConfig, feeResult);
  const scheduleTable = buildFundScheduleTable(usReturns, waReturns, feeResult, aumSchedule, fundLife);

  return {
    feeAnalysis: feeResult,
    aumSchedule,
    scheduleTable,
    usStream: usReturns,
    waStream: waReturns,
    fundWaterfall: waterfall,
    summary: {
      fundSize: fundConfig.fundSize,
      fundLife,
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
// 11. TEST FUNCTION
// ============================================================================

export function testMathEngine() {
  console.log('=== TESTING MATH ENGINE v3 ===\n');

  const fundConfig = {
    fundSize: 50000000,
    fundLife: 10,
    mgtFeeRate: 0.02,
    mgtFeeBase: 'committed',
    orgFeeRate: 0.01,
    orgFeeBase: 'committed',
    opexYears1to5Rate: 0.005,
    opexYears1to5Base: 'committed',
    opexYears6to10Rate: 0.005,
    opexYears6to10Base: 'committed',
    hurdle: 0.06,
    carry: 0.20,
    exitTiming: 'holding',
    fixedExitYear: null,
    exitTranches: 1,
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
    debtTotalRate: 0.125,
    debtCashRate: 0.08,
    votingSharesRate: 0.09,
    prefEquityRate: 0.08,
    prefEquityMethod: 'compound',
    searcherEquityAlloc: 0.01,
    searcherDebtEconomics: 'option1',
    searcherCarryThreshold: 3.0,
    searcherCarryBelow: 0.075,
    searcherCarryAbove: 0.10,
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
  };

  const model = calculateCompleteFundModel(fundConfig, usConfig, waConfig);

  console.log(`Investible Capital: $${(model.summary.investibleCapital / 1e6).toFixed(2)}M`);
  console.log(`Fund DPI: ${model.summary.fundDPI.toFixed(2)}x, Fund IRR: ${(model.summary.grossIRR * 100).toFixed(1)}%`);
  console.log(`Final AUM: $${(model.summary.finalAUM / 1e6).toFixed(2)}M\n`);

  console.log('Schedule table (first 5 rows):');
  model.scheduleTable.slice(0, 5).forEach((row) => {
    console.log(
      `Year ${row.year}: Deployed $${(row.capitalDeployed / 1e6).toFixed(2)}M | Fees $${(row.feesThisYear / 1e6).toFixed(2)}M | Dist $${(row.distributions / 1e6).toFixed(2)}M | AUM $${(row.runningAUM / 1e6).toFixed(2)}M`
    );
  });

  console.log('\n=== TESTS COMPLETE ===');
}
