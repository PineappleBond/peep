/**
 * 数据结构提取脚本 v3
 * 把结果存到文件，避免 console 截断
 */

(async function extractApiStructuresV3() {
  function truncate(val, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) return '...(deep)';
    if (val === null || val === undefined) return val;
    const t = typeof val;
    if (t === 'string') return val.length > 50 ? val.slice(0, 50) + '…' : val;
    if (t === 'number' || t === 'boolean') return val;
    if (Array.isArray(val)) {
      const sliced = val.slice(0, 2);
      return sliced.map(item => truncate(item, depth + 1, maxDepth));
    }
    if (t === 'object') {
      const result = {};
      for (const k of Object.keys(val)) {
        result[k] = truncate(val[k], depth + 1, maxDepth);
      }
      return result;
    }
    return String(val);
  }

  const results = {};

  async function capture(name, fn) {
    try {
      const val = await fn();
      results[name] = truncate(val);
    } catch (err) {
      results[name] = { __error: err.message };
    }
  }

  const testData = { personIds: [], daliurenRecordIds: [], liuyaoRecordIds: [], wikiDocIds: [] };

  try {
    console.log('📦 Person...');
    await capture('PersonList', async () => window.peep.PersonList());

    const p = await window.peep.PersonCreate({
      name: '_struct_v3_' + Date.now(),
      gender: '男',
      date: '1990-01-15',
      timeIndex: 4
    });
    testData.personIds.push(p.id);
    results['PersonCreate'] = truncate(p);

    await capture('PersonGet', async () => window.peep.PersonGet(p.id));
    await capture('PersonUpdate', async () => window.peep.PersonUpdate(p.id, { name: '_updated_' + Date.now() }));
    await capture('PersonDelete', async () => window.peep.PersonDelete(p.id));
    testData.personIds = testData.personIds.filter(id => id !== p.id);

    const testPerson = await window.peep.PersonCreate({
      name: '_test_v3_' + Date.now(),
      gender: '女',
      date: '1985-06-20',
      timeIndex: 6
    });
    testData.personIds.push(testPerson.id);

    console.log('📦 ZiWei...');
    await capture('ZiWei_yearly', async () => window.peep.ZiWei(testPerson.id, 'yearly'));
    await capture('GetScopeData', async () => window.peep.GetScopeData('2024-06-15', testPerson.id));

    console.log('📦 DaLiuRen...');
    const dlr = await window.peep.DaLiuRenCreate({
      personId: testPerson.id,
      question: '结构测试_' + Date.now(),
      note: '测试备注'
    });
    testData.daliurenRecordIds.push(dlr.id);
    results['DaLiuRenCreate'] = truncate(dlr);

    await capture('DaLiuRenList', async () => window.peep.DaLiuRenList({ personId: testPerson.id }));
    await capture('DaLiuRenView', async () => window.peep.DaLiuRenView({ personId: testPerson.id, recordId: dlr.id }));

    console.log('📦 LiuYao...');
    const ly = await window.peep.LiuYaoCreate({
      personId: testPerson.id,
      question: '六爻测试_' + Date.now()
    });
    testData.liuyaoRecordIds.push(ly.id);
    results['LiuYaoCreate'] = truncate(ly);

    await capture('LiuYaoList', async () => window.peep.LiuYaoList({ personId: testPerson.id }));
    await capture('LiuYaoView', async () => window.peep.LiuYaoView({ personId: testPerson.id, recordId: ly.id }));

    console.log('📦 Wiki...');
    const wiki = await window.peep.WikiCreate({
      personId: testPerson.id,
      title: '结构测试_' + Date.now(),
      content: '# 测试\n\n内容内容',
      tags: ['测试']
    });
    testData.wikiDocIds.push(wiki.id);
    results['WikiCreate'] = truncate(wiki);

    await capture('WikiList', async () => window.peep.WikiList({ personId: testPerson.id }));
    await capture('WikiView', async () => window.peep.WikiView({ personId: testPerson.id, docId: wiki.id }));
    await capture('WikiUpdate', async () => window.peep.WikiUpdate({ personId: testPerson.id, docId: wiki.id, title: '已更新' }));

    console.log('📦 Lunar...');
    await capture('SolarToLunar', async () => window.peep.SolarToLunar({ date: '2024-06-15 14:30' }));
    await capture('LunarToSolar', async () => window.peep.LunarToSolar({ year: 2024, month: 5, day: 10 }));
    await capture('GetEightCharacters', async () => window.peep.GetEightCharacters({ date: '2024-06-15 14:30' }));
    await capture('GetSolarTerms', async () => window.peep.GetSolarTerms({ year: 2024 }));
    await capture('GetCurrentSolarTerm', async () => window.peep.GetCurrentSolarTerm({ date: '2024-06-15' }));
    await capture('GetChineseCalendar', async () => window.peep.GetChineseCalendar({ date: '2024-06-15' }));
    await capture('GetDailyInfo', async () => window.peep.GetDailyInfo({ date: '2024-06-15' }));
    await capture('GetZodiac', async () => window.peep.GetZodiac({ date: '1990-06-15' }));
    await capture('GetConstellation', async () => window.peep.GetConstellation({ date: '1990-06-15' }));

    console.log('🧹 清理...');
    for (const docId of testData.wikiDocIds) {
      try { await window.peep.WikiDelete({ personId: testPerson.id, docId }, { skipUI: true }); } catch {}
    }
    for (const recordId of testData.daliurenRecordIds) {
      try { await window.peep.DaLiuRenDelete({ personId: testPerson.id, recordId }, { skipUI: true }); } catch {}
    }
    for (const recordId of testData.liuyaoRecordIds) {
      try { await window.peep.LiuYaoDelete({ personId: testPerson.id, recordId }, { skipUI: true }); } catch {}
    }
    for (const personId of testData.personIds) {
      try { await window.peep.PersonDelete(personId); } catch {}
    }

    // 输出到页面，方便完整复制
    const output = JSON.stringify(results, null, 2);
    const blob = new Blob([output], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'api-structures.json';
    a.textContent = '点击下载 api-structures.json';
    a.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;background:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;font-size:16px;';
    document.body.appendChild(a);

    console.log('✅ 提取完成！点击页面左上角的绿色按钮下载 JSON 文件');
    console.log('共 ' + output.length + ' 字符');

  } catch (err) {
    console.error('提取过程出错:', err);
    console.log('当前已提取的结果:');
    console.log(JSON.stringify(results, null, 2));
  }
})();
