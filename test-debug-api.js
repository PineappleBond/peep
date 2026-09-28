/**
 * 调试 API 完整测试脚本
 * 用于在 Chrome 控制台测试所有 debugApi 函数
 * 包含循环测试和性能验证，最后清空测试数据
 */

(async function testDebugApiComprehensive() {
  console.log('=== 调试 API 完整测试开始 ===\n');
  const startTime = Date.now();
  const testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // 辅助函数：记录测试结果
  function logTest(name, success, duration, details = '') {
    const status = success ? '✅' : '❌';
    console.log(`${status} ${name}: ${duration}ms ${details}`);
    testResults.tests.push({ name, success, duration, details });
    if (success) testResults.passed++;
    else testResults.failed++;
  }

  // 辅助函数：执行测试并计时
  async function runTest(name, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      logTest(name, true, duration, result ? JSON.stringify(result).substring(0, 100) : '');
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      logTest(name, false, duration, err.message);
      throw err;
    }
  }

  // 存储创建的测试数据 ID，用于清理
  const testData = {
    personIds: [],
    daliurenRecordIds: [],
    liuyaoRecordIds: []
  };

  try {
    // ═══════════════════════════════════════════════════════════
    // 1. 系统 API 测试
    // ═══════════════════════════════════════════════════════════
    console.log('\n--- 1. 系统 API 测试 ---');

    await runTest('version', () => {
      window.peep.version();
      return { status: 'ok' };
    });

    await runTest('env', () => {
      window.peep.env();
      return { status: 'ok' };
    });

    await runTest('health', async () => {
      const result = await window.peep.health();
      return { ok: result.ok };
    });

    await runTest('help', () => {
      window.peep.help();
      return { status: 'ok' };
    });

    await runTest('getApiMetadata', async () => {
      const metadata = await window.peep.getApiMetadata();
      return { version: metadata.version };
    });

    await runTest('getCacheStats', async () => {
      const stats = window.peep.getCacheStats();
      return { cacheCount: Object.keys(stats).length };
    });

    // ═══════════════════════════════════════════════════════════
    // 2. Person CRUD 测试
    // ═══════════════════════════════════════════════════════════
    console.log('\n--- 2. Person CRUD 测试 ---');

    // 创建测试人物
    const testPerson1 = await runTest('PersonCreate (测试人物1)', async () => {
      const person = await window.peep.PersonCreate({
        name: '测试人物1_' + Date.now(),
        gender: '男',
        date: '1990-01-15',
        timeIndex: 4
      });
      testData.personIds.push(person.id);
      return { id: person.id, name: person.name };
    });

    const testPerson2 = await runTest('PersonCreate (测试人物2)', async () => {
      const person = await window.peep.PersonCreate({
        name: '测试人物2_' + Date.now(),
        gender: '女',
        date: '1985-06-20',
        timeIndex: 6
      });
      testData.personIds.push(person.id);
      return { id: person.id, name: person.name };
    });

    // 查询人物列表
    await runTest('PersonList', async () => {
      const persons = await window.peep.PersonList({});
      return { count: persons.length };
    });

    // 获取单个人物
    await runTest('PersonGet', async () => {
      const person = await window.peep.PersonGet(testPerson1.id);
      return { id: person.id, name: person.name };
    });

    // 更新人物
    await runTest('PersonUpdate', async () => {
      const updated = await window.peep.PersonUpdate(testPerson1.id, {
        name: '已更新_' + testPerson1.name
      });
      return { id: updated.id, name: updated.name };
    });

    // ═══════════════════════════════════════════════════════════
    // 3. ZiWei 紫微斗数测试
    // ═══════════════════════════════════════════════════════════
    console.log('\n--- 3. ZiWei 紫微斗数测试 ---');

    await runTest('ZiWei (yearly)', async () => {
      const result = await window.peep.ZiWei(testPerson1.id, 'yearly');
      return { hasData: !!result };
    });

    await runTest('ZiWei (decadal)', async () => {
      const result = await window.peep.ZiWei(testPerson1.id, 'decadal');
      return { hasData: !!result };
    });

    await runTest('ZiWei (monthly)', async () => {
      const result = await window.peep.ZiWei(testPerson1.id, 'monthly');
      return { hasData: !!result };
    });

    await runTest('GetScopeData', async () => {
      const result = await window.peep.GetScopeData('2024-06-15', testPerson1.id);
      return { hasScopes: !!result };
    });

    // ═══════════════════════════════════════════════════════════
    // 4. DaLiuRen 大六壬测试（含循环）
    // ═══════════════════════════════════════════════════════════
    console.log('\n--- 4. DaLiuRen 大六壬测试 ---');

    // 创建测试记录
    for (let i = 0; i < 3; i++) {
      const record = await runTest(`DaLiuRenCreate #${i + 1}`, async () => {
        const record = await window.peep.DaLiuRenCreate({
          personId: testPerson1.id,
          question: `测试问题${i + 1}_${Date.now()}`,
          note: `测试备注${i + 1}`
        });
        testData.daliurenRecordIds.push(record.id);
        return { id: record.id };
      });
    }

    // 查询列表
    await runTest('DaLiuRenList', async () => {
      const result = await window.peep.DaLiuRenList({ personId: testPerson1.id });
      return { total: result.total };
    });

    // 查看详情
    if (testData.daliurenRecordIds.length > 0) {
      await runTest('DaLiuRenView', async () => {
        const result = await window.peep.DaLiuRenView({
          personId: testPerson1.id,
          recordId: testData.daliurenRecordIds[0]
        });
        return { id: result.id, question: result.question };
      });
    }

    // 循环测试：连续调用 10 次
    console.log('\n--- DaLiuRen 循环测试 ---');
    const daliurenLoopStart = Date.now();
    for (let i = 0; i < 10; i++) {
      const iterStart = Date.now();
      await window.peep.DaLiuRenList({ personId: testPerson1.id });
      console.log(`  DaLiuRenList #${i + 1}: ${Date.now() - iterStart}ms`);
    }
    console.log(`DaLiuRenList 10次总计: ${Date.now() - daliurenLoopStart}ms`);

    // ═══════════════════════════════════════════════════════════
    // 5. LiuYao 六爻测试（含循环）
    // ═══════════════════════════════════════════════════════════
    console.log('\n--- 5. LiuYao 六爻测试 ---');

    // 创建测试记录
    for (let i = 0; i < 3; i++) {
      const record = await runTest(`LiuYaoCreate #${i + 1}`, async () => {
        const record = await window.peep.LiuYaoCreate({
          personId: testPerson1.id,
          question: `六爻测试${i + 1}_${Date.now()}`
        });
        testData.liuyaoRecordIds.push(record.id);
        return { id: record.id };
      });
    }

    // 查询列表
    await runTest('LiuYaoList', async () => {
      const result = await window.peep.LiuYaoList({ personId: testPerson1.id });
      return { total: result.total };
    });

    // 查看详情
    if (testData.liuyaoRecordIds.length > 0) {
      await runTest('LiuYaoView', async () => {
        const result = await window.peep.LiuYaoView({
          personId: testPerson1.id,
          recordId: testData.liuyaoRecordIds[0]
        });
        return { id: result.id, question: result.question };
      });
    }

    // 循环测试：连续调用 10 次
    console.log('\n--- LiuYao 循环测试 ---');
    const liuyaoLoopStart = Date.now();
    for (let i = 0; i < 10; i++) {
      const iterStart = Date.now();
      await window.peep.LiuYaoList({ personId: testPerson1.id });
      console.log(`  LiuYaoList #${i + 1}: ${Date.now() - iterStart}ms`);
    }
    console.log(`LiuYaoList 10次总计: ${Date.now() - liuyaoLoopStart}ms`);

    // ═══════════════════════════════════════════════════════════
    // 6. Wiki 知识库测试（含循环）
    // ═══════════════════════════════════════════════════════════
    console.log('\n--- 6. Wiki 知识库测试 ---');

    const wikiDocIds = [];

    // 创建测试文档
    for (let i = 0; i < 3; i++) {
      const doc = await runTest(`WikiCreate #${i + 1}`, async () => {
        const doc = await window.peep.WikiCreate({
          personId: testPerson1.id,
          title: `测试文档${i + 1}_${Date.now()}`,
          content: `# 测试文档${i + 1}\n\n这是测试内容。`,
          tags: ['测试', `标签${i + 1}`]
        });
        wikiDocIds.push(doc.id);
        return { id: doc.id, title: doc.title };
      });
    }

    // 查询列表
    await runTest('WikiList', async () => {
      const result = await window.peep.WikiList({ personId: testPerson1.id });
      return { total: result.total };
    });

    // 查看详情
    if (wikiDocIds.length > 0) {
      await runTest('WikiView', async () => {
        const result = await window.peep.WikiView({
          personId: testPerson1.id,
          docId: wikiDocIds[0]
        });
        return { id: result.id, title: result.title };
      });
    }

    // 更新文档
    if (wikiDocIds.length > 0) {
      await runTest('WikiUpdate', async () => {
        const result = await window.peep.WikiUpdate({
          personId: testPerson1.id,
          docId: wikiDocIds[0],
          title: '已更新的文档',
          content: '# 已更新\n\n内容已更新。'
        });
        return { id: result.id, title: result.title };
      });
    }

    // 循环测试：连续调用 10 次
    console.log('\n--- Wiki 循环测试 ---');
    const wikiLoopStart = Date.now();
    for (let i = 0; i < 10; i++) {
      const iterStart = Date.now();
      await window.peep.WikiList({ personId: testPerson1.id });
      console.log(`  WikiList #${i + 1}: ${Date.now() - iterStart}ms`);
    }
    console.log(`WikiList 10次总计: ${Date.now() - wikiLoopStart}ms`);

    // ═══════════════════════════════════════════════════════════
    // 7. 混合循环测试（模拟真实 Agent 场景）
    // ═══════════════════════════════════════════════════════════
    console.log('\n--- 7. 混合循环测试 ---');
    const mixedLoopStart = Date.now();
    for (let i = 0; i < 5; i++) {
      const iterStart = Date.now();
      await window.peep.WikiList({ personId: testPerson1.id });
      await window.peep.DaLiuRenList({ personId: testPerson1.id });
      await window.peep.LiuYaoList({ personId: testPerson1.id });
      console.log(`  混合调用 #${i + 1}: ${Date.now() - iterStart}ms`);
    }
    console.log(`混合调用 5轮总计: ${Date.now() - mixedLoopStart}ms`);

    // ═══════════════════════════════════════════════════════════
    // 8. 清理测试数据（Delete API 需要 skipUI: true）
    // ═══════════════════════════════════════════════════════════
    console.log('\n--- 8. 清理测试数据 ---');

    // 删除 Wiki 文档
    for (const docId of wikiDocIds) {
      await runTest(`WikiDelete #${docId}`, async () => {
        await window.peep.WikiDelete({
          personId: testPerson1.id,
          docId: docId
        }, { skipUI: true });
        return { deleted: docId };
      });
    }

    // 删除大六壬记录
    for (const recordId of testData.daliurenRecordIds) {
      await runTest(`DaLiuRenDelete #${recordId}`, async () => {
        await window.peep.DaLiuRenDelete({
          personId: testPerson1.id,
          recordId: recordId
        }, { skipUI: true });
        return { deleted: recordId };
      });
    }

    // 删除六爻记录
    for (const recordId of testData.liuyaoRecordIds) {
      await runTest(`LiuYaoDelete #${recordId}`, async () => {
        await window.peep.LiuYaoDelete({
          personId: testPerson1.id,
          recordId: recordId
        }, { skipUI: true });
        return { deleted: recordId };
      });
    }

    // 删除测试人物
    for (const personId of testData.personIds) {
      await runTest(`PersonDelete #${personId}`, async () => {
        await window.peep.PersonDelete(personId);
        return { deleted: personId };
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 9. 测试总结
    // ═══════════════════════════════════════════════════════════
    console.log('\n=== 测试完成 ===');
    const totalTime = Date.now() - startTime;
    console.log(`总耗时: ${totalTime}ms`);
    console.log(`通过: ${testResults.passed}, 失败: ${testResults.failed}`);

    if (testResults.failed === 0) {
      console.log('✅ 所有测试通过！');
    } else {
      console.log(`❌ 有 ${testResults.failed} 个测试失败`);
      console.log('失败的测试:');
      testResults.tests
        .filter(t => !t.success)
        .forEach(t => console.log(`  - ${t.name}: ${t.details}`));
    }

    if (totalTime < 30000) {
      console.log('✅ 性能通过：总耗时 < 30 秒（不会超时）');
    } else {
      console.error('❌ 性能失败：总耗时 >= 30 秒（会超时）');
    }

  } catch (err) {
    console.error('\n❌ 测试过程中发生错误:', err);
  }
})();
