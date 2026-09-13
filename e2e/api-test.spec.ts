/**
 * Comprehensive API test for window.peep
 * Tests all 41+ API functions across 10 groups
 */
import { test, expect } from '@playwright/test';

// Helper to safely call API and capture result/error
async function safeCall(page: any, fn: string, args: any) {
  return await page.evaluate(async ({ fn, args }) => {
    try {
      const parts = fn.split('.');
      let obj = window.peep;
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
      let obj = window.peep;
      for (const p of parts) obj = obj[p];
      const result = await obj(...argsArray);
      return { ok: true, result: JSON.parse(JSON.stringify(result ?? null)), error: null };
    } catch (e) {
      return { ok: false, result: null, error: String(e) };
    }
  }, { fn, argsArray });
}

// Track results
const results: Array<{
  api: string;
  scenario: string;
  pass: boolean;
  response: any;
  notes: string;
}> = [];

function record(api: string, scenario: string, pass: boolean, response: any, notes = '') {
  results.push({ api, scenario, pass, response: JSON.stringify(response).substring(0, 200), notes });
}

test.describe.serial('Peep API Comprehensive Test', () => {
  let page: any;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('./');
    await page.waitForFunction(() => !!(window as any).peep);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ============================================================
  // PHASE 1: Basic APIs (no dependencies)
  // ============================================================

  test.describe('Phase 1: Basic APIs', () => {

    // ── person.create ──
    test.describe('person.create', () => {
      test('required params only', async () => {
        const r = await safeCall(page, 'person.create', {
          name: '测试用户A', gender: 'male', birthDate: '1990-01-15'
        });
        record('person.create', 'required', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('id');
        expect(r.result.name).toBe('测试用户A');
        expect(r.result.gender).toBe('male');
        expect(r.result.birthDate).toBe('1990-01-15');
      });

      test('all params', async () => {
        const r = await safeCall(page, 'person.create', {
          name: '测试用户B', gender: 'female', birthDate: '1985-06-20',
          birthTime: '14:30', isLunar: false, note: '**备注**测试'
        });
        record('person.create', 'all-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result.birthTime).toBe('14:30');
        expect(r.result.note).toBe('**备注**测试');
      });

      test('lunar date', async () => {
        const r = await safeCall(page, 'person.create', {
          name: '农历用户', gender: 'male', birthDate: '1990-03-15', isLunar: true
        });
        record('person.create', 'lunar', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result.isLunar).toBe(true);
      });

      test('missing required field', async () => {
        const r = await safeCall(page, 'person.create', { name: '缺性别' });
        record('person.create', 'missing-required', r.ok, r.error, 'Should fail or have undefined fields');
        // Dexie may accept it with undefined fields - record the behavior
      });

      test('empty name', async () => {
        const r = await safeCall(page, 'person.create', {
          name: '', gender: 'male', birthDate: '2000-01-01'
        });
        record('person.create', 'empty-name', r.ok, r.result);
      });
    });

    // ── person.get ──
    test.describe('person.get', () => {
      test('valid id', async () => {
        const r = await safeCall(page, 'person.get', 1);
        record('person.get', 'valid-id', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('id', 1);
      });

      test('non-existent id', async () => {
        const r = await safeCall(page, 'person.get', 9999);
        record('person.get', 'nonexistent', r.ok, r.result);
        // get returns undefined for missing
      });

      test('null id', async () => {
        const r = await safeCall(page, 'person.get', null);
        record('person.get', 'null-id', r.ok, r.result);
      });
    });

    // ── person.list ──
    test.describe('person.list', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'person.list', undefined);
        record('person.list', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
        expect(r.result.length).toBeGreaterThanOrEqual(1);
      });

      test('with search', async () => {
        const r = await safeCall(page, 'person.list', { search: '测试' });
        record('person.list', 'search', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result.length).toBeGreaterThanOrEqual(1);
      });

      test('search no match', async () => {
        const r = await safeCall(page, 'person.list', { search: '不存在的名字XYZABC' });
        record('person.list', 'no-match', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result.length).toBe(0);
      });
    });

    // ── person.update ──
    test.describe('person.update', () => {
      test('valid update', async () => {
        const r = await safeCallMulti(page, 'person.update', [1, { name: '更新后的名字' }]);
        record('person.update', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
        // Verify
        const g = await safeCall(page, 'person.get', 1);
        expect(g.result.name).toBe('更新后的名字');
      });

      test('update non-existent', async () => {
        const r = await safeCallMulti(page, 'person.update', [9999, { name: '不存在' }]);
        record('person.update', 'nonexistent', r.ok, r.result);
        // Dexie update on non-existent returns 0, doesn't throw
      });

      test('empty changes', async () => {
        const r = await safeCallMulti(page, 'person.update', [1, {}]);
        record('person.update', 'empty-changes', r.ok, r.result);
      });
    });

    // ── folder.create ──
    test.describe('folder.create', () => {
      test('root folder', async () => {
        const r = await safeCallMulti(page, 'folder.create', ['根文件夹A']);
        record('folder.create', 'root', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(typeof r.result).toBe('object'); // returns { id, title, parentId, ... }
        expect(r.result).toHaveProperty('id');
      });

      test('with parent', async () => {
        const parent = await safeCallMulti(page, 'folder.create', ['父文件夹']);
        const r = await safeCallMulti(page, 'folder.create', ['子文件夹', parent.result.id]);
        record('folder.create', 'with-parent', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(typeof r.result).toBe('object');
        expect(r.result).toHaveProperty('id');
      });

      test('empty title', async () => {
        const r = await safeCallMulti(page, 'folder.create', ['']);
        record('folder.create', 'empty-title', r.ok, r.result);
      });
    });

    // ── folder.get ──
    test.describe('folder.get', () => {
      test('valid id', async () => {
        const list = await safeCall(page, 'folder.list', undefined);
        if (list.result.length > 0) {
          const r = await safeCall(page, 'folder.get', list.result[0].id);
          record('folder.get', 'valid-id', r.ok, r.result);
          expect(r.ok).toBe(true);
          expect(r.result).toHaveProperty('id');
          expect(r.result).toHaveProperty('title');
        }
      });

      test('non-existent id', async () => {
        const r = await safeCall(page, 'folder.get', 'non-existent-id');
        record('folder.get', 'nonexistent', r.ok, r.result);
      });
    });

    // ── folder.list ──
    test.describe('folder.list', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'folder.list', undefined);
        record('folder.list', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
      });
    });

    // ── folder.tree ──
    test.describe('folder.tree', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'folder.tree', undefined);
        record('folder.tree', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
        // Check tree node structure
        if (r.result.length > 0) {
          expect(r.result[0]).toHaveProperty('id');
          expect(r.result[0]).toHaveProperty('title');
          expect(r.result[0]).toHaveProperty('children');
          expect(r.result[0]).toHaveProperty('documentCount');
        }
      });
    });

    // ── folder.update ──
    test.describe('folder.update', () => {
      test('valid update', async () => {
        const list = await safeCall(page, 'folder.list', undefined);
        if (list.result.length > 0) {
          const id = list.result[0].id;
          const r = await safeCallMulti(page, 'folder.update', [id, { title: '更新后文件夹名' }]);
          record('folder.update', 'valid', r.ok, r.result);
          expect(r.ok).toBe(true);
        }
      });

      test('non-existent', async () => {
        const r = await safeCallMulti(page, 'folder.update', ['fake-id', { title: 'x' }]);
        record('folder.update', 'nonexistent', r.ok, r.result);
      });
    });

    // ── tag.list ──
    test.describe('tag.list', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'tag.list', undefined);
        record('tag.list', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
      });
    });
  });

  // ============================================================
  // PHASE 2: Document APIs (depend on person/folder/tag)
  // ============================================================

  test.describe('Phase 2: Document APIs', () => {
    let recallId: number;
    let diaryId: number;
    let notesId: number;
    let personId: number;

    test.beforeAll(async () => {
      // Create a person for document associations
      const p = await safeCall(page, 'person.create', {
        name: '文档测试人物', gender: 'male', birthDate: '1992-05-10'
      });
      personId = p.result.id;
    });

    // ── recall.create (via document.recall) ──
    test.describe('recall.create', () => {
      test('required params (all optional)', async () => {
        const r = await safeCall(page, 'document.recall.create', {});
        record('recall.create', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(typeof r.result).toBe('number'); // returns auto-increment id
        recallId = r.result;
      });

      test('all params', async () => {
        const r = await safeCall(page, 'document.recall.create', {
          title: '测试回忆录', content: '# 内容\n\n正文',
          personId, tags: ['重要', '测试']
        });
        record('recall.create', 'all-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        recallId = r.result;
      });

      test('with folder', async () => {
        const folders = await safeCall(page, 'folder.list', undefined);
        let folderId = null;
        if (folders.result.length > 0) folderId = folders.result[0].id;
        const r = await safeCall(page, 'document.recall.create', {
          title: '带文件夹的回忆录', folderId
        });
        record('recall.create', 'with-folder', r.ok, r.result);
        expect(r.ok).toBe(true);
      });
    });

    // ── recall.list ──
    test.describe('recall.list', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.recall.list', {});
        record('recall.list', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
        expect(r.result.length).toBeGreaterThanOrEqual(1);
      });

      test('filter by personId', async () => {
        const r = await safeCall(page, 'document.recall.list', { personId });
        record('recall.list', 'personId', r.ok, r.result);
        expect(r.ok).toBe(true);
      });

      test('search', async () => {
        const r = await safeCall(page, 'document.recall.list', { search: '测试' });
        record('recall.list', 'search', r.ok, r.result);
        expect(r.ok).toBe(true);
      });

      test('filter by tags', async () => {
        const r = await safeCall(page, 'document.recall.list', { tags: ['重要'] });
        record('recall.list', 'tags', r.ok, r.result);
        expect(r.ok).toBe(true);
      });
    });

    // ── recall.view ──
    test.describe('recall.view', () => {
      test('valid id', async () => {
        const r = await safeCall(page, 'document.recall.view', recallId);
        record('recall.view', 'valid-id', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('id');
        expect(r.result).toHaveProperty('type', 'recall');
      });

      test('non-existent id', async () => {
        const r = await safeCall(page, 'document.recall.view', 'non-existent-uuid');
        record('recall.view', 'nonexistent', r.ok, r.error);
        expect(r.ok).toBe(false);
      });
    });

    // ── recall.openNew ──
    test.describe('recall.openNew', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.recall.openNew', {});
        record('recall.openNew', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('type', 'recall');
      });

      test('with params', async () => {
        const r = await safeCall(page, 'document.recall.openNew', {
          personId, title: '预填标题', content: '预填内容'
        });
        record('recall.openNew', 'with-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result.title).toBe('预填标题');
      });
    });

    // ── recall.openList ──
    test.describe('recall.openList', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.recall.openList', {});
        record('recall.openList', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
      });

      test('with personId', async () => {
        const r = await safeCall(page, 'document.recall.openList', { personId });
        record('recall.openList', 'with-personId', r.ok, r.result);
        expect(r.ok).toBe(true);
      });
    });

    // ── diary.create (via document.diary) ──
    test.describe('diary.create', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.diary.create', {});
        record('diary.create', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        diaryId = r.result;
      });

      test('all params', async () => {
        const r = await safeCall(page, 'document.diary.create', {
          title: '测试日记', content: '今天天气好',
          personId, tags: ['日常']
        });
        record('diary.create', 'all-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        diaryId = r.result;
      });
    });

    // ── diary.list ──
    test.describe('diary.list', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.diary.list', {});
        record('diary.list', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
      });

      test('with filters', async () => {
        const r = await safeCall(page, 'document.diary.list', { personId, search: '天气' });
        record('diary.list', 'filters', r.ok, r.result);
        expect(r.ok).toBe(true);
      });
    });

    // ── diary.view ──
    test.describe('diary.view', () => {
      test('valid id', async () => {
        const r = await safeCall(page, 'document.diary.view', diaryId);
        record('diary.view', 'valid-id', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result.type).toBe('diary');
      });

      test('non-existent', async () => {
        const r = await safeCall(page, 'document.diary.view', 'bad-uuid');
        record('diary.view', 'nonexistent', r.ok, r.error);
        expect(r.ok).toBe(false);
      });
    });

    // ── diary.openNew ──
    test.describe('diary.openNew', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.diary.openNew', {});
        record('diary.openNew', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result.type).toBe('diary');
      });
    });

    // ── diary.openList ──
    test.describe('diary.openList', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.diary.openList', {});
        record('diary.openList', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
      });
    });

    // ── notes.create (via document.notes) ──
    test.describe('notes.create', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.notes.create', {});
        record('notes.create', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        notesId = r.result;
      });

      test('all params', async () => {
        const r = await safeCall(page, 'document.notes.create', {
          title: '测试笔记', content: '学习笔记内容',
          personId, tags: ['学习']
        });
        record('notes.create', 'all-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        notesId = r.result;
      });
    });

    // ── notes.list ──
    test.describe('notes.list', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.notes.list', {});
        record('notes.list', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
      });
    });

    // ── notes.view ──
    test.describe('notes.view', () => {
      test('valid id', async () => {
        const r = await safeCall(page, 'document.notes.view', notesId);
        record('notes.view', 'valid-id', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result.type).toBe('notes');
      });
    });

    // ── notes.openNew ──
    test.describe('notes.openNew', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.notes.openNew', {});
        record('notes.openNew', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
      });
    });

    // ── notes.openList ──
    test.describe('notes.openList', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'document.notes.openList', {});
        record('notes.openList', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
      });
    });

    // ── document.get ──
    test.describe('document.get', () => {
      test('valid id', async () => {
        const r = await safeCall(page, 'document.get', recallId);
        record('document.get', 'valid-id', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('id');
      });

      test('non-existent', async () => {
        const r = await safeCall(page, 'document.get', 'bad-id');
        record('document.get', 'nonexistent', r.ok, r.result);
        // Returns undefined for missing
      });
    });

    // ── document.update ──
    test.describe('document.update', () => {
      test('valid update', async () => {
        const r = await safeCallMulti(page, 'document.update', [recallId, { title: '更新后的回忆录标题' }]);
        record('document.update', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
      });

      test('non-existent', async () => {
        const r = await safeCallMulti(page, 'document.update', ['bad-id', { title: 'x' }]);
        record('document.update', 'nonexistent', r.ok, r.result);
      });
    });

    // ── document.edit ──
    test.describe('document.edit', () => {
      test('valid edit', async () => {
        const r = await safeCallMulti(page, 'document.edit', [
          recallId, 1, 1, '替换后的第一行内容'
        ]);
        record('document.edit', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
      });

      test('non-existent doc', async () => {
        const r = await safeCallMulti(page, 'document.edit', ['bad-id', 1, 1, 'x']);
        record('document.edit', 'nonexistent', r.ok, r.error);
        expect(r.ok).toBe(false);
      });

      test('out of range lines', async () => {
        const r = await safeCallMulti(page, 'document.edit', [
          recallId, 100, 200, '超出范围'
        ]);
        record('document.edit', 'out-of-range', r.ok, r.result);
      });
    });

    // ── document.replace ──
    test.describe('document.replace', () => {
      test('valid replace', async () => {
        // First set content
        await safeCallMulti(page, 'document.update', [recallId, { content: '关键词ABC在其他文本中' }]);
        const r = await safeCallMulti(page, 'document.replace', [recallId, '关键词ABC', '替换值XYZ']);
        record('document.replace', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('count');
      });

      test('keyword not found', async () => {
        const r = await safeCallMulti(page, 'document.replace', [recallId, '不存在的关键词ZZZ', '替换']);
        record('document.replace', 'not-found', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result.count).toBe(0);
      });

      test('non-existent doc', async () => {
        const r = await safeCallMulti(page, 'document.replace', ['bad-id', 'k', 'v']);
        record('document.replace', 'nonexistent', r.ok, r.error);
        expect(r.ok).toBe(false);
      });
    });

    // ── document.open ──
    test.describe('document.open', () => {
      test('valid id', async () => {
        const r = await safeCall(page, 'document.open', recallId);
        record('document.open', 'valid-id', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('id');
      });

      test('non-existent', async () => {
        const r = await safeCall(page, 'document.open', 'bad-id');
        record('document.open', 'nonexistent', r.ok, r.error);
        expect(r.ok).toBe(false);
      });
    });

    // ── tag.add ──
    test.describe('tag.add', () => {
      test('valid add', async () => {
        const r = await safeCallMulti(page, 'tag.add', [recallId, '新标签']);
        record('tag.add', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
        // Verify tag was added
        const doc = await safeCall(page, 'document.get', recallId);
        expect(doc.result.tags).toContain('新标签');
      });

      test('duplicate tag', async () => {
        const r = await safeCallMulti(page, 'tag.add', [recallId, '新标签']);
        record('tag.add', 'duplicate', r.ok, r.result);
        expect(r.ok).toBe(true);
        // Should not duplicate
      });

      test('non-existent doc', async () => {
        const r = await safeCallMulti(page, 'tag.add', ['bad-id', '标签']);
        record('tag.add', 'nonexistent-doc', r.ok, r.result);
        // Silently returns (no doc found)
      });
    });

    // ── tag.remove ──
    test.describe('tag.remove', () => {
      test('valid remove', async () => {
        const r = await safeCallMulti(page, 'tag.remove', [recallId, '新标签']);
        record('tag.remove', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
        const doc = await safeCall(page, 'document.get', recallId);
        expect(doc.result.tags).not.toContain('新标签');
      });

      test('remove non-existent tag', async () => {
        const r = await safeCallMulti(page, 'tag.remove', [recallId, '不存在的标签']);
        record('tag.remove', 'nonexistent-tag', r.ok, r.result);
        expect(r.ok).toBe(true);
      });
    });

    // ── document.delete ──
    test.describe('document.delete', () => {
      test('valid delete', async () => {
        // Create a throwaway doc
        const c = await safeCall(page, 'document.recall.create', { title: '待删除' });
        const r = await safeCall(page, 'document.delete', c.result);
        record('document.delete', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
        // Verify deleted
        const g = await safeCall(page, 'document.get', c.result);
        expect(g.result === null || g.result === undefined).toBe(true);
      });

      test('non-existent', async () => {
        const r = await safeCall(page, 'document.delete', 'bad-id');
        record('document.delete', 'nonexistent', r.ok, r.result);
      });
    });
  });

  // ============================================================
  // PHASE 3: Fortune-telling APIs
  // ============================================================

  test.describe('Phase 3: Fortune-telling APIs', () => {
    let testPersonId: number;

    test.beforeAll(async () => {
      const p = await safeCall(page, 'person.create', {
        name: '命理测试', gender: 'male', birthDate: '1990-08-15', birthTime: '10:30'
      });
      testPersonId = p.result.id;
    });

    // ── bazi.chart ──
    test.describe('bazi.chart', () => {
      test('valid personId', async () => {
        const r = await safeCallMulti(page, 'bazi.chart', [testPersonId, { level: 'dayun', datetime: '2026-01-01H00' }]);
        record('bazi.chart', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('图表');
      });

      test('non-existent personId', async () => {
        const r = await safeCallMulti(page, 'bazi.chart', [99999, { level: 'dayun', datetime: '2026-01-01H00' }]);
        record('bazi.chart', 'nonexistent', r.ok, r.error);
        expect(r.ok).toBe(false);
      });

      test('null personId', async () => {
        const r = await safeCallMulti(page, 'bazi.chart', [null, { level: 'dayun', datetime: '2026-01-01H00' }]);
        record('bazi.chart', 'null', r.ok, r.error || r.result);
      });
    });

    // ── ziwei.chart ──
    test.describe('ziwei.chart', () => {
      test('valid personId', async () => {
        const r = await safeCallMulti(page, 'ziwei.chart', [testPersonId, { level: 'dayun', datetime: '2026-01-01H00' }]);
        record('ziwei.chart', 'valid', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('星盘');
      });

      test('non-existent personId', async () => {
        const r = await safeCallMulti(page, 'ziwei.chart', [99999, { level: 'dayun', datetime: '2026-01-01H00' }]);
        record('ziwei.chart', 'nonexistent', r.ok, r.error);
        expect(r.ok).toBe(false);
      });
    });

    // ── liuyao.create ──
    test.describe('liuyao.create', () => {
      test('required params', async () => {
        const r = await safeCall(page, 'liuyao.create', {
          lines: [1, 2, 0, 3, 1, 2]
        });
        record('liuyao.create', 'required', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(typeof r.result).toBe('number');
      });

      test('all params', async () => {
        const r = await safeCall(page, 'liuyao.create', {
          lines: [1, 1, 1, 1, 1, 1],
          question: '今年运势如何？',
          background: '刚换了工作',
          scenarioId: 'career',
          personId: String(testPersonId),
          personName: '命理测试'
        });
        record('liuyao.create', 'all-params', r.ok, r.result);
        expect(r.ok).toBe(true);
      });

      test('invalid lines (wrong length)', async () => {
        const r = await safeCall(page, 'liuyao.create', {
          lines: [1, 2, 3] // only 3, need 6
        });
        record('liuyao.create', 'invalid-lines', r.ok, r.error || r.result);
      });

      test('invalid line values', async () => {
        const r = await safeCall(page, 'liuyao.create', {
          lines: [0, 1, 2, 3, 4, 5] // 4,5 are invalid
        });
        record('liuyao.create', 'invalid-values', r.ok, r.error || r.result);
      });
    });

    // ── liuyao.get ──
    test.describe('liuyao.get', () => {
      test('valid id', async () => {
        // First create a record
        const c = await safeCall(page, 'liuyao.create', { lines: [1, 2, 3, 2, 1, 0] });
        const r = await safeCall(page, 'liuyao.get', c.result);
        record('liuyao.get', 'valid-id', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(r.result).toHaveProperty('编号');
        expect(r.result).toHaveProperty('本卦');
      });

      test('with granularity', async () => {
        const c = await safeCall(page, 'liuyao.create', { lines: [0, 1, 2, 1, 0, 3] });
        const r = await safeCallMulti(page, 'liuyao.get', [c.result, 'month']);
        record('liuyao.get', 'granularity', r.ok, r.result);
        expect(r.ok).toBe(true);
      });

      test('non-existent', async () => {
        const r = await safeCall(page, 'liuyao.get', 'bad-id');
        record('liuyao.get', 'nonexistent', r.ok, r.result);
      });
    });

    // ── liuyao.list ──
    test.describe('liuyao.list', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'liuyao.list', {});
        record('liuyao.list', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
        expect(r.result.length).toBeGreaterThanOrEqual(1);
      });

      test('with personId', async () => {
        const r = await safeCall(page, 'liuyao.list', { personId: String(testPersonId) });
        record('liuyao.list', 'personId', r.ok, r.result);
        expect(r.ok).toBe(true);
      });
    });

    // ── liuyao.scenarios ──
    test.describe('liuyao.scenarios', () => {
      test('no params', async () => {
        const r = await safeCall(page, 'liuyao.scenarios', undefined);
        record('liuyao.scenarios', 'no-params', r.ok, r.result);
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.result)).toBe(true);
        expect(r.result.length).toBeGreaterThan(0);
        // Check structure
        expect(r.result[0]).toHaveProperty('id');
        expect(r.result[0]).toHaveProperty('title');
      });
    });
  });

  // ============================================================
  // PHASE 4: Cleanup & additional discovery
  // ============================================================

  test.describe('Phase 4: Discovery', () => {
    test('enumerate all API groups and methods', async () => {
      const enumeration = await page.evaluate(() => {
        const api = (window as any).peep;
        const groups: Record<string, string[]> = {};
        for (const key of Object.keys(api)) {
          if (typeof api[key] === 'object' && api[key] !== null) {
            groups[key] = Object.keys(api[key]).filter(k => typeof api[key][k] === 'function');
          }
        }
        return groups;
      });
      record('API.enumerate', 'discovery', true, enumeration, 'All groups and methods');
      console.log('Discovered API groups:', JSON.stringify(enumeration, null, 2));
    });

    test('person.delete cleanup', async () => {
      // Create and delete
      const c = await safeCall(page, 'person.create', {
        name: '待删除', gender: 'female', birthDate: '2000-01-01'
      });
      const r = await safeCall(page, 'person.delete', c.result.id);
      record('person.delete', 'valid', r.ok, r.result);
      expect(r.ok).toBe(true);
      const g = await safeCall(page, 'person.get', c.result.id);
      expect(g.result === null || g.result === undefined).toBe(true);
    });

    test('folder.delete cleanup', async () => {
      const c = await safeCallMulti(page, 'folder.create', ['待删除文件夹']);
      const r = await safeCall(page, 'folder.delete', c.result.id);
      record('folder.delete', 'valid', r.ok, r.result);
      expect(r.ok).toBe(true);
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
    console.log('\n====== API TEST REPORT ======');
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
