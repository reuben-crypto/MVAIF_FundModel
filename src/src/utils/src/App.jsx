import React, { useState, useEffect } from 'react'
import { calculateCompleteFundModel, testMathEngine } from './utils/mathEngine'
import PerformanceStrip from './components/PerformanceStrip'
import ControlTabs from './components/ControlTabs'
import FundFeesModule from './components/modules/FundFeesModule'
import USStreamModule from './components/modules/USStreamModule'
import WAStreamModule from './components/modules/WAStreamModule'
import SensitivityMatrix from './components/modules/SensitivityMatrix'

export default function App() {
  const [activeTab, setActiveTab] = useState('fund-fees')

  // Fund Configuration State
  const [fundConfig, setFundConfig] = useState({
    fundSize: 50000000,
    fundLife: 10,
    investingPeriod: 5,
    mgtFeeRate: 0.02,
    mgtFeeBase: 'committed',
    stepDownActive: false,
    stepDownRate: 0.015,
    stepDownBase: 'committed',
    stepDownStartYear: 6,
    orgFeeRate: 0.01,
    opexYears1to5Rate: 0.005,
    opexYears1to5Base: 'committed',
    opexYears6to10Rate: 0.005,
    opexYears6to10Base: 'committed',
    hurdle: 0.06,
    carry: 0.20,
  })

  // US Stream Configuration
  const [usConfig, setUSConfig] = useState({
    streamAllocationPct: 0.40,
    dealsPerYear: 2,
    totalDeals: 5,
    holdingYearsMin: 4,
    holdingYearsMax: 6,
    equityMoic: 3.0,
    debtRate: 0.125,
    debtCashRate: 0.08,
    debtPikRate: 0.045,
    votingSharesRate: 0.09,
    prefEquityRate: 0.08,
    prefEquityMethod: 'compound',
    debtAllocation: 0.50,
    equityAllocation: 0.50,
    searcherEquityAlloc: 0.01,
    searcherDebtEconomics: 'option1',
    searcherCarryThreshold: 3.0,
    searcherCarryBelow: 0.075,
    searcherCarryAbove: 0.10,
  })

  // WA Stream Configuration
  const [waConfig, setWAConfig] = useState({
    streamAllocationPct: 0.60,
    dealsPerYear: 2,
    dealCap: 6,
    holdingYearsMin: 4,
    holdingYearsMax: 6,
    baseMoic: 2.0,
    debtAllocation: 0.70,
    equityAllocation: 0.30,
  })

  // Calculate results
  const [results, setResults] = useState(null)

  useEffect(() => {
    const modelResults = calculateCompleteFundModel(fundConfig, usConfig, waConfig)
    setResults(modelResults)
    console.log('Model recalculated:', modelResults)
  }, [fundConfig, usConfig, waConfig])

  const handleFundConfigChange = (newConfig) => {
    setFundConfig({ ...fundConfig, ...newConfig })
  }

  const handleUSConfigChange = (newConfig) => {
    setUSConfig({ ...usConfig, ...newConfig })
  }

  const handleWAConfigChange = (newConfig) => {
    setWAConfig({ ...waConfig, ...newConfig })
  }

  const handleTestMath = () => {
    console.clear()
    testMathEngine()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">Mirepa Fund Model Dashboard</h1>
          <p className="text-gray-600 mt-2">Institutional LBO & Growth Fund Modeling</p>
          <button
            onClick={handleTestMath}
            className="mt-4 px-4 py-2 text-sm bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Run Math Tests
          </button>
        </div>
      </div>

      {/* Performance Strip */}
      {results && <PerformanceStrip results={results} />}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs Navigation */}
        <ControlTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Tab Content */}
        <div className="mt-6 bg-white rounded-lg shadow">
          {activeTab === 'fund-fees' && (
            <FundFeesModule
              config={fundConfig}
              onChange={handleFundConfigChange}
              results={results}
            />
          )}

          {activeTab === 'us-deals' && (
            <USStreamModule
              config={usConfig}
              onChange={handleUSConfigChange}
              results={results?.usStream}
            />
          )}

          {activeTab === 'wa-deals' && (
            <WAStreamModule
              config={waConfig}
              onChange={handleWAConfigChange}
              results={results?.waStream}
            />
          )}

          {activeTab === 'sensitivity' && <SensitivityMatrix results={results} />}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-100 border-t border-gray-200 p-6 mt-12">
        <div className="max-w-7xl mx-auto text-center text-gray-600 text-sm">
          <p>Mirepa Capital Group | Fund Modeling Dashboard v1.0</p>
        </div>
      </div>
    </div>
  )
}
