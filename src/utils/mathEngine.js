/**
 * Mirepa Fund Modeling Math Engine
 * Pure functions for all financial calculations
 * No side effects, fully testable
 */

// ============================================================================
// 1. FUND FEE WATERFALL CALCULATION
// ============================================================================

export function calculateFundFees(fundConfig) {
  const {
    fundSize = 50000000,
    fundLife = 10,
    investingPeriod = 5,
    mgtFeeRate = 0.02,
    mgtFeeBase = 'committed', // 'committed' or 'aum'
    stepDownActive = false,
    stepDownRate = 0.015,
    stepDownBase = 'committed',
    stepDownStartYear = 6,
    orgFeeRate = 0.01,
    opexYears1to5Rate = 0.005,
    opexYears1to5Base = 'committed',
    opexYears6to10Rate = 0.005,
    opexYears6to10Base = 'committed',
  } = fundConfig;

  const yearlyMgtFees = [];
  const yearlyOpex = [];
  let totalMgtFees = 0;
  let totalOpex = 0;
  const orgFee = fundSize * orgFeeRate;

  // Calculate year-by-year fees
  for (let year = 1; year <= fundLife; year++) {
    // Management Fees
    let mgtFeeForYear = 0;
    if (year < stepDownStartYear || !stepDownActive) {
      // Before step-down: use regular rate
      const base = mgtFeeBase === 'committed' ? fundSize : fundSize;
      mgtFeeForYear = base * mgtFeeRate;
    } else {
      // After step-down: use stepped rate
      const base = stepDownBase === 'committed' ? fundSize : fundSize;
      mgtFeeForYear = base * stepDownRate;
    }
    yearlyMgtFees.push(mgtFeeForYear);
    totalMgtFees += mgtFeeForYear;

    // Operating Expenses (changes base at year 6)
    let opexForYear = 0;
    if (year <= 5) {
      const base = opexYears1to5Base === 'committed' ? fundSize : fundSize;
      opexForYear = base * opexYears1to5Rate;
    } else {
      const base = opexYears6to10Base === 'committed' ? fundSize : fundSize;
      opexForYear = base * opexYears6to10Rate;
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
    feeBreakdown: {
      mgtFees: totalMgtFees,
      orgFee: orgFee,
      opex: totalOpex,
    },
  };
}

// ============================================================================
// 2. DEBT INTEREST COMPOUNDING (Debt Tranche: Principal + Cash + PIK Interest)
// ============================================================================

export function compoundDebtInterest(principal, totalRate, cashRate, pikRate, holdingYears) {
  const cashInterestPerYear = principal * cashRate;
  const totalCashInterest = cashInterestPerYear * holdingYears;

  // PIK compounds annually
  const pikInterestAccrued = principal * (Math.pow(1 + pikRate, holdingYears) - 1);
  const totalAtExit = principal + totalCashInterest + pikInterestAccrued;

  return {
    principal,
    cashInterestPerYear,
    totalCashInterest,
    pikInterestAccrued,
    totalAtExit,
    totalRate,
    breakdown: {
      principal,
      cashInterest: totalCashInterest,
      pikInterest: pikInterestAccrued,
    },
  };
}

// ============================================================================
// 3. PREFERRED EQUITY COMPOUNDING (Compound or Simple)
// ============================================================================

export function compoundPreferredEquity(principal, rate, holdingYears, compoundMethod = 'compound') {
  let totalAccrued = 0;

  if (compoundMethod === 'compound') {
    totalAccrued = principal * Math.pow(1 + rate, holdingYears);
  } else if (compoundMethod === 'simple') {
    totalAccrued = principal * (1 + rate * holdingYears);
  }

  return {
    principal,
    rate,
    holdingYears,
    compoundMethod,
    totalAccrued,
    interestGenerated: totalAccrued - principal,
  };
}

// ============================================================================
// 4. SIMPLE IRR APPROXIMATION (for quick calculations)
// ============================================================================

function approximateIRR(investedCapital, exitProceeds, holdingYears) {
  if (investedCapital <= 0 || exitProceeds <= investedCapital) {
    return 0;
  }
  // IRR ≈ (Exit Proceeds / Invested Capital) ^ (1 / Holding Years) - 1
  return Math.pow(exitProceeds / investedCapital, 1 / holdingYears) - 1;
}

// ============================================================================
// 5. US STREAM RETURNS (Sponsored Search Model)
// ============================================================================

export function calculateUSStreamReturns(streamCapital, config, deals = []) {
  const {
    dealsPerYear = 2,
    totalDeals = 5,
    holdingYearsMin = 4,
    holdingYearsMax = 6,
    equityMoic = 3.0,
    debtRate = 0.125,
    debtCashRate = 0.08,
    debtPikRate = 0.045,
    votingSharesRate = 0.09,
    prefEquityRate = 0.08,
    prefEquityMethod = 'compound',
    debtAllocation = 0.50,
    equityAllocation = 0.50,
    searcherEquityAlloc = 0.01,
    searcherDebtEconomics = 'option1', // 'option1' | 'option2' | 'option3'
    searcherCarryThreshold = 3.0,
    searcherCarryBelow = 0.075,
    searcherCarryAbove = 0.10,
  } = config;

  const avgDealSize = streamCapital / totalDeals;
  const holdingYears = (holdingYearsMin + holdingYearsMax) / 2; // Use average holding period

  // ===== PER DEAL CALCULATION =====
  const debtTranche = avgDealSize * debtAllocation;
  const equityTranche = avgDealSize * equityAllocation;

  // Debt returns (8% cash + 4.5% PIK)
  const debtResult = compoundDebtInterest(debtTranche, debtRate, debtCashRate, debtPikRate, holdingYears);
  const debtReturns = debtResult.totalAtExit;

  // Equity returns (voting shares + preferred equity)
  const votingSharesAmount = equityTranche * votingSharesRate;
  const prefEquityAmount = equityTranche * (1 - votingSharesRate);

  const votingSharesReturns = votingSharesAmount * equityMoic; // MOIC applied
  const prefEquityResult = compoundPreferredEquity(prefEquityAmount, prefEquityRate, holdingYears, prefEquityMethod);
  const prefEquityReturns = prefEquityResult.totalAccrued;

  const totalEquityReturns = votingSharesReturns + prefEquityReturns;
  const totalPerDealProceeds = debtReturns + totalEquityReturns;
  const dealIRR = approximateIRR(avgDealSize, totalPerDealProceeds, holdingYears);

  // ===== STREAM AGGREGATE =====
  const totalInvested = streamCapital;
  const totalGrossProceeds = totalPerDealProceeds * totalDeals;
  const streamIRR = approximateIRR(totalInvested, totalGrossProceeds, holdingYears);
  const streamDPI = totalGrossProceeds / totalInvested;

  // ===== SEARCHER ECONOMICS =====
  const searcherEquityOnDeals = avgDealSize * equityAllocation * searcherEquityAlloc;
  let searcherDebtEconomicValue = 0;

  if (searcherDebtEconomics === 'option1') {
    // 1% PIK on debt
    searcherDebtEconomicValue = debtTranche * 0.01 * holdingYears;
  } else if (searcherDebtEconomics === 'option2') {
    // 0.5% cash + 0.5% PIK
    searcherDebtEconomicValue = (debtTranche * 0.005 * holdingYears) + 
                                 (debtTranche * 0.005 * holdingYears);
  } else if (searcherDebtEconomics === 'option3') {
    // 0.5% to fund expenses (not paid to searcher)
    searcherDebtEconomicValue = 0;
  }

  const searcherCarry = equityMoic >= searcherCarryThreshold ? searcherCarryAbove : searcherCarryBelow;

  return {
    dealCount: totalDeals,
    avgDealSize,
    holdingYears,
    totalInvested,
    totalGrossProceeds,
    grossIRR: streamIRR,
    netIRR: streamIRR, // Placeholder - will refine with carry logic
    dpi: streamDPI,
    moic: streamDPI,
    carriedInterest: 0, // Will be calculated at fund level
    perDealMetrics: {
      debtTranche,
      debtReturns,
      equityTranche,
      equityReturns: totalEquityReturns,
      totalProceeds: totalPerDealProceeds,
      dealIRR,
      dealMoic: totalPerDealProceeds / avgDealSize,
    },
    searcherEconomics: {
      equityAllocPercent: searcherEquityAlloc,
      equityValue: searcherEquityOnDeals,
      debtEconomics: searcherDebtEconomics,
      debtEconomicValue: searcherDebtEconomicValue,
      carryRate: searcherCarry,
      carryThreshold: searcherCarryThreshold,
    },
  };
}

// ============================================================================
// 6. WEST AFRICA STREAM RETURNS
// ============================================================================

export function calculateWAStreamReturns(streamCapital, config, deals = []) {
  const {
    dealsPerYear = 2,
    dealCap = 6,
    holdingYearsMin = 4,
    holdingYearsMax = 6,
    baseMoic = 2.0,
    debtAllocation = 0.70,
    equityAllocation = 0.30,
  } = config;

  const dealCount = Math.min(deals.length || dealCap, dealCap);
  const avgDealSize = streamCapital / dealCount;
  const holdingYears = (holdingYearsMin + holdingYearsMax) / 2;

  // ===== PER DEAL CALCULATION =====
  const debtTranche = avgDealSize * debtAllocation;
  const equityTranche = avgDealSize * equityAllocation;

  // Simplified: base MOIC applied to entire investment
  const totalPerDealProceeds = avgDealSize * baseMoic;
  const dealIRR = approximateIRR(avgDealSize, totalPerDealProceeds, holdingYears);

  // ===== STREAM AGGREGATE =====
  const totalInvested = streamCapital;
  const totalGrossProceeds = totalPerDealProceeds * dealCount;
  const streamIRR = approximateIRR(totalInvested, totalGrossProceeds, holdingYears);
  const streamDPI = totalGrossProceeds / totalInvested;

  return {
    dealCount,
    avgDealSize,
    holdingYears,
    totalInvested,
    totalGrossProceeds,
    grossIRR: streamIRR,
    netIRR: streamIRR,
    dpi: streamDPI,
    moic: streamDPI,
    baseMoic,
    carriedInterest: 0,
    perDealMetrics: {
      debtTranche,
      equityTranche,
      totalProceeds: totalPerDealProceeds,
      dealIRR,
      dealMoic: baseMoic,
    },
  };
}

// ============================================================================
// 7. FUND-LEVEL WATERFALL (LP/GP CARRY DISTRIBUTIONS)
// ============================================================================

export function calculateFundWaterfall(usStreamReturns, waStreamReturns, fundConfig) {
  const { hurdle = 0.06, carry = 0.20, fundSize = 50000000 } = fundConfig;

  const usProceeds = usStreamReturns.totalGrossProceeds;
  const waProceeds = waStreamReturns.totalGrossProceeds;
  const totalGrossProceeds = usProceeds + waProceeds;
  const totalInvested = fundSize;
  const returnOfCapital = Math.min(totalGrossProceeds, totalInvested);
  const gainAboveCapital = Math.max(0, totalGrossProceeds - totalInvested);

  // Hurdle calculation
  const hurdleReturn = totalInvested * hurdle;
  const excessAboveHurdle = Math.max(0, gainAboveCapital - hurdleReturn);
  const gpCarry = excessAboveHurdle * carry;
  const lpShare = totalGrossProceeds - gpCarry;

  // Fund-level metrics
  const fundDPI = totalGrossProceeds / totalInvested;
  const fundIRR = approximateIRR(totalInvested, totalGrossProceeds, fundConfig.fundLife);

  return {
    totalGrossProceeds,
    returnOfCapital,
    gainAboveCapital,
    hurdleReturn,
    excessAboveHurdle,
    lpShare,
    gpCarry,
    gpCarryPercentage: carry,
    dpi: fundDPI,
    irr: fundIRR,
    grossIRR: fundIRR,
    netIRR: fundIRR, // Simplified; doesn't account for investor fees
    usContribution: {
      proceeds: usProceeds,
      dpi: usStreamReturns.dpi,
      irr: usStreamReturns.grossIRR,
    },
    waContribution: {
      proceeds: waProceeds,
      dpi: waStreamReturns.dpi,
      irr: waStreamReturns.grossIRR,
    },
  };
}

// ============================================================================
// 8. COMPLETE FUND MODEL CALCULATION
// ============================================================================

export function calculateCompleteFundModel(fundConfig, usConfig, waConfig) {
  // Step 1: Calculate investible capital
  const feeResult = calculateFundFees(fundConfig);
  const investibleCapital = feeResult.investibleCapital;

  // Step 2: Allocate to streams
  const usAllocation = usConfig.streamAllocationPct || 0.40;
  const waAllocation = waConfig.streamAllocationPct || 0.60;

  const usStreamCapital = investibleCapital * usAllocation;
  const waStreamCapital = investibleCapital * waAllocation;

  // Step 3: Calculate stream returns
  const usReturns = calculateUSStreamReturns(usStreamCapital, usConfig);
  const waReturns = calculateWAStreamReturns(waStreamCapital, waConfig);

  // Step 4: Calculate fund waterfall
  const waterfall = calculateFundWaterfall(usReturns, waReturns, fundConfig);

  return {
    feeAnalysis: feeResult,
    usStream: usReturns,
    waStream: waReturns,
    fundWaterfall: waterfall,
    summary: {
      fundSize: fundConfig.fundSize,
      totalFees: feeResult.totalFees,
      investibleCapital,
      usCapital: usStreamCapital,
      waCapital: waStreamCapital,
      totalGrossProceeds: waterfall.totalGrossProceeds,
      grossIRR: waterfall.grossIRR,
      fundDPI: waterfall.dpi,
      gpCarry: waterfall.gpCarry,
      lpDistributions: waterfall.lpShare,
    },
  };
}

// ============================================================================
// 9. TEST FUNCTION
// ============================================================================

export function testMathEngine() {
  console.log('=== TESTING MATH ENGINE ===\n');

  // Test 1: Fund Fees
  console.log('TEST 1: calculateFundFees');
  const fundConfig = {
    fundSize: 50000000,
    fundLife: 10,
    mgtFeeRate: 0.02,
    mgtFeeBase: 'committed',
    orgFeeRate: 0.01,
    opexYears1to5Rate: 0.005,
    opexYears6to10Rate: 0.005,
  };
  const feeResult = calculateFundFees(fundConfig);
  console.log(`✓ Fund Size: $${(feeResult.fundSize / 1000000).toFixed(1)}M`);
  console.log(`✓ Total Fees: $${(feeResult.totalFees / 1000000).toFixed(2)}M`);
  console.log(`✓ Investible Capital: $${(feeResult.investibleCapital / 1000000).toFixed(2)}M\n`);

  // Test 2: Debt Compounding
  console.log('TEST 2: compoundDebtInterest');
  const debtResult = compoundDebtInterest(10000000, 0.125, 0.08, 0.045, 5);
  console.log(`✓ Principal: $${(debtResult.principal / 1000000).toFixed(1)}M`);
  console.log(`✓ Total Cash Interest: $${(debtResult.totalCashInterest / 1000000).toFixed(2)}M`);
  console.log(`✓ Total at Exit: $${(debtResult.totalAtExit / 1000000).toFixed(2)}M\n`);

  // Test 3: US Stream
  console.log('TEST 3: calculateUSStreamReturns');
  const usConfig = {
    totalDeals: 5,
    equityMoic: 3.0,
    holdingYearsMin: 4,
    holdingYearsMax: 6,
  };
  const usResult = calculateUSStreamReturns(20000000, usConfig);
  console.log(`✓ Average Deal Size: $${(usResult.avgDealSize / 1000000).toFixed(2)}M`);
  console.log(`✓ Stream DPI: ${usResult.dpi.toFixed(2)}x`);
  console.log(`✓ Stream IRR: ${(usResult.grossIRR * 100).toFixed(1)}%\n`);

  // Test 4: WA Stream
  console.log('TEST 4: calculateWAStreamReturns');
  const waConfig = {
    dealCap: 6,
    baseMoic: 2.0,
    holdingYearsMin: 4,
    holdingYearsMax: 6,
  };
  const waResult = calculateWAStreamReturns(30000000, waConfig);
  console.log(`✓ Deal Count: ${waResult.dealCount}`);
  console.log(`✓ Stream DPI: ${waResult.dpi.toFixed(2)}x`);
  console.log(`✓ Stream IRR: ${(waResult.grossIRR * 100).toFixed(1)}%\n`);

  // Test 5: Fund Waterfall
  console.log('TEST 5: calculateFundWaterfall');
  const waterfallResult = calculateFundWaterfall(usResult, waResult, fundConfig);
  console.log(`✓ Total Gross Proceeds: $${(waterfallResult.totalGrossProceeds / 1000000).toFixed(2)}M`);
  console.log(`✓ Fund DPI: ${waterfallResult.dpi.toFixed(2)}x`);
  console.log(`✓ Fund IRR: ${(waterfallResult.irr * 100).toFixed(1)}%`);
  console.log(`✓ GP Carry: $${(waterfallResult.gpCarry / 1000000).toFixed(2)}M\n`);

  // Test 6: Complete Model
  console.log('TEST 6: calculateCompleteFundModel');
  const completeModel = calculateCompleteFundModel(fundConfig, usConfig, waConfig);
  console.log(`✓ Investible Capital: $${(completeModel.summary.investibleCapital / 1000000).toFixed(2)}M`);
  console.log(`✓ Fund Gross IRR: ${(completeModel.summary.grossIRR * 100).toFixed(1)}%`);
  console.log(`✓ Fund DPI: ${completeModel.summary.fundDPI.toFixed(2)}x`);
  console.log(`✓ LP Distributions: $${(completeModel.summary.lpDistributions / 1000000).toFixed(2)}M\n`);

  console.log('=== ALL TESTS COMPLETE ===');
}
