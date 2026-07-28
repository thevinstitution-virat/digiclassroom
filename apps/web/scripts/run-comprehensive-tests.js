#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * 🧪 TESTING: Runs all end-to-end and integration tests for the DigiClassroom AI Tutor
 * 🛡️ VALIDATION: Ensures complete pipeline functionality and zero hallucination
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  timeout: 60000, // 60 seconds per test suite
  testSuites: [
    {
      name: 'Full Stack Integration',
      file: 'src/__tests__/full-stack.test.ts',
      description: 'Tests new Phase 8 Infrastructure (Provider A/B, Fail-Open Gates)'
    }
  ],
  reportFile: 'test-results/comprehensive-test-report.json',
  logFile: 'test-results/comprehensive-test.log'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class ComprehensiveTestRunner {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      endTime: null,
      totalDuration: 0,
      testSuites: [],
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        successRate: 0
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd()
      }
    };
  }

  log(message, color = 'reset') {
    const timestamp = new Date().toISOString();
    const coloredMessage = `${colors[color]}${message}${colors.reset}`;
    console.log(`[${timestamp}] ${coloredMessage}`);

    // Also write to log file
    this.writeToLogFile(`[${timestamp}] ${message}`);
  }

  writeToLogFile(message) {
    const logDir = path.dirname(TEST_CONFIG.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFileSync(TEST_CONFIG.logFile, message + '\n');
  }

  async runTestSuite(testSuite) {
    this.log(`🧪 Starting test suite: ${testSuite.name}`, 'cyan');
    this.log(`📝 Description: ${testSuite.description}`, 'blue');

    const startTime = Date.now();

    return new Promise((resolve) => {
      // Create a platform-independent way to set the env var for the child process
      const env = { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' };
      const jestProcess = spawn('npx', ['jest', testSuite.file, '--verbose', '--json', '--config', 'jest.node.config.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env
      });

      let stdout = '';
      let stderr = '';

      jestProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jestProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jestProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        let testResult = {
          name: testSuite.name,
          file: testSuite.file,
          description: testSuite.description,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration,
          exitCode: code,
          success: code === 0,
          stdout,
          stderr,
          testResults: null,
          summary: {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0
          }
        };

        // Parse human-readable output instead of JSON since ts-jest pollutes stdout
        const output = stdout + '\n' + stderr;
        const totalMatch = output.match(/Tests:\s*(?:(\d+)\s*failed,\s*)?(?:(\d+)\s*passed,\s*)?(\d+)\s*total/);

        if (totalMatch) {
          testResult.summary.failedTests = parseInt(totalMatch[1] || '0', 10);
          testResult.summary.passedTests = parseInt(totalMatch[2] || '0', 10);
          testResult.summary.totalTests = parseInt(totalMatch[3] || '0', 10);
        } else {
          // Fallback
          testResult.summary.totalTests = 1;
          testResult.summary.passedTests = code === 0 ? 1 : 0;
          testResult.summary.failedTests = code === 0 ? 0 : 1;
        }

        if (testResult.success) {
          this.log(`✅ Test suite completed successfully: ${testSuite.name}`, 'green');
          this.log(`📊 Results: ${testResult.summary.passedTests} passed, ${testResult.summary.failedTests} failed, ${testResult.summary.skippedTests} skipped`, 'green');
        } else {
          this.log(`❌ Test suite failed: ${testSuite.name}`, 'red');
          this.log(`📊 Results: ${testResult.summary.passedTests} passed, ${testResult.summary.failedTests} failed, ${testResult.summary.skippedTests} skipped`, 'red');

          if (stderr) {
            this.log(`🔍 Error output:`, 'red');
            this.log(stderr, 'red');
          }
        }

        this.log(`⏱️ Duration: ${(duration / 1000).toFixed(2)}s`, 'blue');

        resolve(testResult);
      });

      // Set timeout
      setTimeout(() => {
        jestProcess.kill('SIGTERM');
        this.log(`⏰ Test suite timed out: ${testSuite.name}`, 'yellow');
      }, TEST_CONFIG.timeout);
    });
  }

  async runAllTests() {
    this.log('🚀 Starting comprehensive test run...', 'bright');
    this.log(`📋 Running ${TEST_CONFIG.testSuites.length} test suites`, 'blue');

    const overallStartTime = Date.now();

    // Clear previous log file
    if (fs.existsSync(TEST_CONFIG.logFile)) {
      fs.unlinkSync(TEST_CONFIG.logFile);
    }

    // Run each test suite
    for (const testSuite of TEST_CONFIG.testSuites) {
      const result = await this.runTestSuite(testSuite);
      this.results.testSuites.push(result);

      // Update overall summary
      this.results.summary.totalTests += result.summary.totalTests;
      this.results.summary.passedTests += result.summary.passedTests;
      this.results.summary.failedTests += result.summary.failedTests;
      this.results.summary.skippedTests += result.summary.skippedTests;
    }

    // Calculate final metrics
    const overallEndTime = Date.now();
    this.results.endTime = new Date(overallEndTime).toISOString();
    this.results.totalDuration = overallEndTime - overallStartTime;

    if (this.results.summary.totalTests > 0) {
      this.results.summary.successRate = (this.results.summary.passedTests / this.results.summary.totalTests) * 100;
    }

    // Generate final report
    this.generateFinalReport();
  }

  generateFinalReport() {
    this.log('📊 Generating comprehensive test report...', 'cyan');

    // Write JSON report
    const reportDir = path.dirname(TEST_CONFIG.reportFile);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(TEST_CONFIG.reportFile, JSON.stringify(this.results, null, 2));

    // Console summary
    this.log('', 'reset');
    this.log('═══════════════════════════════════════════════════════════════', 'bright');
    this.log('🎯 COMPREHENSIVE TEST RESULTS SUMMARY', 'bright');
    this.log('═══════════════════════════════════════════════════════════════', 'bright');

    this.log(`📊 Overall Results:`, 'bright');
    this.log(`   Total Tests: ${this.results.summary.totalTests}`, 'blue');
    this.log(`   ✅ Passed: ${this.results.summary.passedTests}`, 'green');
    this.log(`   ❌ Failed: ${this.results.summary.failedTests}`, this.results.summary.failedTests > 0 ? 'red' : 'green');
    this.log(`   ⏭️ Skipped: ${this.results.summary.skippedTests}`, 'yellow');
    this.log(`   📈 Success Rate: ${this.results.summary.successRate.toFixed(1)}%`,
      this.results.summary.successRate >= 90 ? 'green' : this.results.summary.successRate >= 70 ? 'yellow' : 'red');

    this.log(``, 'reset');
    this.log(`⏱️ Timing:`, 'bright');
    this.log(`   Total Duration: ${(this.results.totalDuration / 1000).toFixed(2)}s`, 'blue');
    this.log(`   Started: ${this.results.startTime}`, 'blue');
    this.log(`   Ended: ${this.results.endTime}`, 'blue');

    this.log(``, 'reset');
    this.log(`📋 Test Suite Details:`, 'bright');

    this.results.testSuites.forEach((suite, index) => {
      const status = suite.success ? '✅' : '❌';
      const color = suite.success ? 'green' : 'red';

      this.log(`   ${index + 1}. ${status} ${suite.name}`, color);
      this.log(`      Duration: ${(suite.duration / 1000).toFixed(2)}s`, 'blue');
      this.log(`      Tests: ${suite.summary.passedTests}/${suite.summary.totalTests} passed`, color);
    });

    this.log(``, 'reset');
    this.log(`📁 Reports Generated:`, 'bright');
    this.log(`   JSON Report: ${TEST_CONFIG.reportFile}`, 'blue');
    this.log(`   Log File: ${TEST_CONFIG.logFile}`, 'blue');

    this.log('═══════════════════════════════════════════════════════════════', 'bright');

    // Final status
    const overallSuccess = this.results.summary.failedTests === 0 && this.results.summary.totalTests > 0;

    if (overallSuccess) {
      this.log('🎉 ALL TESTS PASSED! DigiClassroom AI Tutor is ready for production.', 'green');
    } else if (this.results.summary.successRate >= 90) {
      this.log('⚠️ Most tests passed, but some issues need attention.', 'yellow');
    } else {
      this.log('❌ Significant test failures detected. Please review and fix issues.', 'red');
    }

    // Exit with appropriate code
    process.exit(overallSuccess ? 0 : 1);
  }
}

// Main execution
async function main() {
  const runner = new ComprehensiveTestRunner();

  try {
    await runner.runAllTests();
  } catch (error) {
    runner.log(`💥 Fatal error during test execution: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Test run interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test run terminated');
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ComprehensiveTestRunner;
