/**
 * API test for modified and newly added window.peep APIs:
 * - liuyao.create (auto-toss when lines not provided)
 * - liuyao.update (new)
 * - liuyao.delete (new)
 * - lunar/calendar/utils/analysis tool APIs (newly registered)
 */
import { test, expect } from '@playwright/test';

// Helper to call API and capture result/error
async function safeCall(page: any, fn: string, args: any) {
  return await page.evaluate(async ({ fn, args }) => {
    try {
      const parts = fn.split('.');
      let obj = (window as any).peep;
      for (const p of parts) obj = obj[p];
      const result = await obj(args);
      return { ok: true, result: JSON.parse(JSON.stringify(result ?? null)), error: null };
    } catch (e) {
      return { ok: false, result: null, error: String(e) };
    }
  }, { fn, args });
}

async function safeCallMulti(page: any, fn: string, argsArray: any[]) {
  return await page.evaluate(async ({ fn, argsArray }) => {
    try {
      const parts = fn.split('.');
      let obj = (window as any).peep;
      for (const p of parts) obj = obj[p];
      const result = await obj(...argsArray);
      return { ok: true, result: JSON.parse(JSON.stringify(result ?? null)), error: null };
    } catch (e) {
      return { ok: false, result: null, error: String(e) };
    }
  }, { fn, argsArray });
}

const results: Array<{ api: string; scenario: string; pass: boolean; response: any; notes: string }> = [];

function record(api: string, scenario: string, pass: boolean, response: any, notes = '') {
  results.push({ api, scenario, pass, response: JSON.stringify(response).substring(0, 300), notes });
}

test.describe.serial('Modified & New API Tests', () => {
  let page: any;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).peep);
    console.log('Page loaded, window.peep available');
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ============================================================
  // 1. liuyao.create - Auto-toss (no lines required)
  // ============================================================
  test.describe('liuyao.create (modified)', () => {
    test('auto-toss: no lines provided', async () => {
      const r = await safeCall(page, 'liuyao.create', { question: '测试问题' });
      record('liuyao.create', 'auto-toss', r.ok, r.result);
      expect(r.ok).toBe(true);
      expect(typeof r.result).toBe('number'); // auto-increment id
    });

    test('auto-toss: verify generated lines are valid', async () => {
      const id = await safeCall(page, 'liuyao.create', { question: '验证自动生成爻' });
      expect(id.ok).toBe(true);
      const getResult = await safeCall(page, 'liuyao.get', id.result);
      expect(getResult.ok).toBe(true);
      expect(getResult.result).toHaveProperty('本卦');
      expect(getResult.result.本卦).toHaveProperty('爻');
      expect(getResult.result.本卦.爻.length).toBe(6);
      // Each 爻 should have valid yang property (boolean)
      for (const yao of getResult.result.本卦.爻) {
        expect(typeof yao.阳).toBe('boolean');
      }
      console.log('Auto-generated lines:', getResult.result.本卦.爻.map((a: any) => a.阳 ? 1 : 2));
      record('liuyao.create', 'auto-toss-verify', true, getResult.result.本卦.爻.map((a: any) => a.阳 ? 1 : 2));
    });

    test('with explicit lines (backward compatibility)', async () => {
      const r = await safeCall(page, 'liuyao.create', {
        lines: [1, 2, 0, 3, 1, 2],
        question: '手动指定爻'
      });
      record('liuyao.create', 'explicit-lines', r.ok, r.result);
      expect(r.ok).toBe(true);
      expect(typeof r.result).toBe('number');
    });

    test('empty input (no question, no lines)', async () => {
      const r = await safeCall(page, 'liuyao.create', {});
      record('liuyao.create', 'empty-input', r.ok, r.result);
      expect(r.ok).toBe(true);
      expect(typeof r.result).toBe('number');
    });
  });

  // ============================================================
  // 2. liuyao.update (new)
  // ============================================================
  test.describe('liuyao.update (new)', () => {
    let testId: number;

    test.beforeAll(async () => {
      const c = await safeCall(page, 'liuyao.create', { question: '原始问题' });
      testId = c.result;
    });

    test('update question', async () => {
      const r = await safeCallMulti(page, 'liuyao.update', [testId, { question: '更新后的问题' }]);
      record('liuyao.update', 'update-question', r.ok, r.result);
      expect(r.ok).toBe(true);
      // Verify via get (returns chart with 占事 field)
      const g = await safeCall(page, 'liuyao.get', testId);
      expect(g.ok).toBe(true);
      expect(g.result.占事).toBe('更新后的问题');
      record('liuyao.update', 'verify-question', true, g.result.占事);
    });

    test('update background', async () => {
      const r = await safeCallMulti(page, 'liuyao.update', [testId, { background: '新增背景信息' }]);
      record('liuyao.update', 'update-background', r.ok, r.result);
      expect(r.ok).toBe(true);
      const g = await safeCall(page, 'liuyao.get', testId);
      expect(g.result.背景).toBe('新增背景信息');
    });

    test('update non-existent id', async () => {
      const r = await safeCallMulti(page, 'liuyao.update', [99999, { question: '不存在' }]);
      record('liuyao.update', 'non-existent', r.ok, r.error || 'no error');
      // Dexie update on non-existent returns 0, doesn't throw
    });

    test('update with empty changes', async () => {
      const r = await safeCallMulti(page, 'liuyao.update', [testId, {}]);
      record('liuyao.update', 'empty-changes', r.ok, r.result);
      expect(r.ok).toBe(true);
    });
  });

  // ============================================================
  // 3. liuyao.delete (new)
  // ============================================================
  test.describe('liuyao.delete (new)', () => {
    test('delete existing record', async () => {
      const c = await safeCall(page, 'liuyao.create', { question: '待删除' });
      expect(c.ok).toBe(true);
      const deleteId = c.result;

      const r = await safeCall(page, 'liuyao.delete', deleteId);
      record('liuyao.delete', 'valid', r.ok, r.result);
      expect(r.ok).toBe(true);

      // Verify deleted (get returns undefined for deleted records)
      const g = await safeCall(page, 'liuyao.get', deleteId);
      expect(g.result === null || g.result === undefined).toBe(true);
      record('liuyao.delete', 'verify-deleted', g.result === null || g.result === undefined, g.result);
    });

    test('delete non-existent id', async () => {
      const r = await safeCall(page, 'liuyao.delete', 99999);
      record('liuyao.delete', 'non-existent', r.ok, r.result);
      // Dexie delete on non-existent doesn't throw
      expect(r.ok).toBe(true);
    });
  });

  // ============================================================
  // 4. Tool APIs (newly registered)
  // ============================================================
  test.describe('Tool APIs', () => {
    // ── lunar tools ──
    test.describe('lunar tools', () => {
      test('lunar.todayLunar', async () => {
        const r = await safeCall(page, 'lunar.todayLunar', undefined);
        record('lunar.todayLunar', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        console.log('todayLunar result:', r.result);
      });

      test('lunar.solar2lunar', async () => {
        // solar2lunar takes a Date object
        const r = await page.evaluate(async () => {
          try {
            const result = await (window as any).peep.lunar.solar2lunar(new Date(2024, 0, 1));
            return { ok: true, result: JSON.parse(JSON.stringify(result ?? null)), error: null };
          } catch (e) {
            return { ok: false, result: null, error: String(e) };
          }
        });
        record('lunar.solar2lunar', '2024-1-1', r.ok, r.result);
        expect(r.ok).toBe(true);
        console.log('solar2lunar result:', r.result);
      });

      test('lunar.yearGanZhi', async () => {
        const r = await safeCall(page, 'lunar.yearGanZhi', 2024);
        record('lunar.yearGanZhi', '2024', r.ok, r.result);
        expect(r.ok).toBe(true);
        console.log('yearGanZhi result:', r.result);
      });
    });

    // ── calendar tools ──
    test.describe('calendar tools', () => {
      test('calendar.yearGanZhi', async () => {
        const r = await safeCall(page, 'calendar.yearGanZhi', 2024);
        record('calendar.yearGanZhi', '2024', r.ok, r.result);
        expect(r.ok).toBe(true);
        console.log('calendar.yearGanZhi result:', r.result);
      });

      test('calendar.calculateLiuNian', async () => {
        const r = await safeCallMulti(page, 'calendar.calculateLiuNian', ['甲', 1990]);
        record('calendar.calculateLiuNian', 'jia-1990', r.ok, r.result);
        expect(r.ok).toBe(true);
        console.log('calculateLiuNian result:', r.result);
      });
    });

    // ── utils tools ──
    test.describe('utils tools', () => {
      test('utils.isYangStem', async () => {
        const r = await safeCall(page, 'utils.isYangStem', '甲');
        record('utils.isYangStem', 'jia', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(typeof r.result).toBe('boolean');
        console.log('isYangStem(甲):', r.result);
      });

      test('utils.branchRelation', async () => {
        const r = await safeCallMulti(page, 'utils.branchRelation', ['子', '午']);
        record('utils.branchRelation', 'zi-wu', r.ok, r.result);
        expect(r.ok).toBe(true);
        console.log('branchRelation(子, 午):', r.result);
      });

      test('utils.timeIndexFromClock', async () => {
        const r = await safeCallMulti(page, 'utils.timeIndexFromClock', [14, 30]);
        record('utils.timeIndexFromClock', '14-30', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(typeof r.result).toBe('number');
        console.log('timeIndexFromClock(14, 30):', r.result);
      });
    });

    // ── analysis tools ──
    test.describe('analysis tools', () => {
      let testPersonId: number;
      let chartData: any;

      test.beforeAll(async () => {
        // Create a person for testing
        const p = await safeCall(page, 'person.create', {
          name: '分析测试',
          gender: 'male',
          birthDate: '1990-01-01',
          birthTime: '12:00'
        });
        expect(p.ok).toBe(true);
        testPersonId = p.result.id;

        // Get the chart (needs scope parameter)
        const c = await safeCallMulti(page, 'ziwei.chart', [testPersonId, { level: 'dayun', datetime: '2026-01-01H00' }]);
        expect(c.ok).toBe(true);
        chartData = c.result.星盘;
      });

      test('analysis.detectPatterns', async () => {
        const r = await safeCall(page, 'analysis.detectPatterns', chartData);
        record('analysis.detectPatterns', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
        console.log('detectPatterns result keys:', Object.keys(r.result || {}));
      });

      test('analysis.analyzeChart', async () => {
        const r = await safeCall(page, 'analysis.analyzeChart', chartData);
        record('analysis.analyzeChart', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
        console.log('analyzeChart result keys:', Object.keys(r.result || {}));
      });
    });
  });

  // ============================================================
  // Final report
  // ============================================================
  test('Generate final report', async () => {
    const summary = {
      total: results.length,
      passed: results.filter(r => r.pass).length,
      failed: results.filter(r => !r.pass).length,
    };
    console.log('\n====== MODIFIED & NEW API TEST REPORT ======');
    console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}\n`);
    for (const r of results) {
      const status = r.pass ? '✓' : '✗';
      console.log(`${status} [${r.api}] ${r.scenario}: ${r.notes || ''}`);
      if (!r.pass) {
        console.log(`  Response: ${r.response}`);
      }
    }
    console.log('\n====== END REPORT ======');
  });
});
