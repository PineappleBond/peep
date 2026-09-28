/**
 * WikiLink 调试 API 测试
 *
 * 测试范围：
 * 1. WikiLink skipUI=true - 替换模式
 * 2. WikiLink skipUI=true - 追加模式
 * 3. 参数验证
 * 4. 文档存在性验证
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WikiCreate, WikiLink, WikiView } from "./wiki";
import { WikiError } from "./errors";
import { db, type Person } from "../personDb";

async function clearDatabase() {
  await db.wikiLinks.clear();
  await db.wikiDocs.clear();
  await db.persons.clear();
}

async function createTestPerson() {
  const id = await db.persons.add({
    savedAt: Date.now(),
    isDefault: true,
    name: "测试人物",
    date: "1990-01-01",
    timeIndex: 0,
    gender: "男",
    calendar: "solar",
    isLeapMonth: false,
    exactTime: "",
    useTrueSolar: false,
    placeMode: "china",
    province: "",
    city: "",
    district: "",
    timezone: "",
    algorithm: "default",
    yearDivide: "exact",
    mutagenTable: "zhongzhou",
    dayDivide: "forward",
    astroType: "heaven",
    residence: "",
  } as Person);
  return id;
}

describe("WikiLink skipUI=true", () => {
  let testPersonId: number;
  let doc1Id: number;
  let doc2Id: number;
  let doc3Id: number;
  let doc4Id: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();

    // 创建4个测试文档
    const doc1 = await WikiCreate(
      {
        personId: testPersonId,
        title: "文档1",
        content: "内容1",
      },
      { skipUI: true },
    );
    doc1Id = doc1.id!;

    const doc2 = await WikiCreate(
      {
        personId: testPersonId,
        title: "文档2",
        content: "内容2",
      },
      { skipUI: true },
    );
    doc2Id = doc2.id!;

    const doc3 = await WikiCreate(
      {
        personId: testPersonId,
        title: "文档3",
        content: "内容3",
      },
      { skipUI: true },
    );
    doc3Id = doc3.id!;

    const doc4 = await WikiCreate(
      {
        personId: testPersonId,
        title: "文档4",
        content: "内容4",
      },
      { skipUI: true },
    );
    doc4Id = doc4.id!;
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("替换模式：建立文档关联", async () => {
    const result = await WikiLink(
      {
        sourceDocId: doc1Id,
        targetDocIds: [doc2Id, doc3Id, doc4Id],
      },
      { skipUI: true },
    );

    expect(result.sourceDocId).toBe(doc1Id);
    expect(result.targetDocIds).toHaveLength(3);
    expect(result.targetDocIds).toContain(doc2Id);
    expect(result.targetDocIds).toContain(doc3Id);
    expect(result.targetDocIds).toContain(doc4Id);

    // 验证 WikiView 能正确返回链接
    const view = await WikiView({ docId: doc1Id }, { skipUI: true });
    expect(view.linkTargetIds).toHaveLength(3);
    expect(view.linkTargetIds).toContain(doc2Id);
  });

  it("替换模式：清除现有链接后重新建立", async () => {
    // 先建立到 doc2 的链接
    await WikiLink(
      {
        sourceDocId: doc1Id,
        targetDocIds: [doc2Id],
      },
      { skipUI: true },
    );

    // 替换为到 doc3 和 doc4 的链接
    const result = await WikiLink(
      {
        sourceDocId: doc1Id,
        targetDocIds: [doc3Id, doc4Id],
      },
      { skipUI: true },
    );

    expect(result.targetDocIds).toHaveLength(2);
    expect(result.targetDocIds).not.toContain(doc2Id);
    expect(result.targetDocIds).toContain(doc3Id);
    expect(result.targetDocIds).toContain(doc4Id);
  });

  it("追加模式：在现有链接基础上追加", async () => {
    // 先建立到 doc2 的链接
    await WikiLink(
      {
        sourceDocId: doc1Id,
        targetDocIds: [doc2Id],
      },
      { skipUI: true },
    );

    // 追加到 doc3 和 doc4 的链接
    const result = await WikiLink(
      {
        sourceDocId: doc1Id,
        targetDocIds: [doc3Id, doc4Id],
        append: true,
      },
      { skipUI: true },
    );

    expect(result.targetDocIds).toHaveLength(3);
    expect(result.targetDocIds).toContain(doc2Id);
    expect(result.targetDocIds).toContain(doc3Id);
    expect(result.targetDocIds).toContain(doc4Id);
  });

  it("追加模式：去重（不重复添加已存在的链接）", async () => {
    // 先建立到 doc2 和 doc3 的链接
    await WikiLink(
      {
        sourceDocId: doc1Id,
        targetDocIds: [doc2Id, doc3Id],
      },
      { skipUI: true },
    );

    // 追加 doc3 和 doc4（doc3 已存在）
    const result = await WikiLink(
      {
        sourceDocId: doc1Id,
        targetDocIds: [doc3Id, doc4Id],
        append: true,
      },
      { skipUI: true },
    );

    expect(result.targetDocIds).toHaveLength(3);
    expect(result.targetDocIds).toContain(doc2Id);
    expect(result.targetDocIds).toContain(doc3Id);
    expect(result.targetDocIds).toContain(doc4Id);
  });

  it("空 targetDocIds 清除所有链接", async () => {
    // 先建立链接
    await WikiLink(
      {
        sourceDocId: doc1Id,
        targetDocIds: [doc2Id, doc3Id],
      },
      { skipUI: true },
    );

    // 清空链接
    const result = await WikiLink(
      {
        sourceDocId: doc1Id,
        targetDocIds: [],
      },
      { skipUI: true },
    );

    expect(result.targetDocIds).toHaveLength(0);

    const view = await WikiView({ docId: doc1Id }, { skipUI: true });
    expect(view.linkTargetIds).toHaveLength(0);
  });

  it("不存在的源文档抛出错误", async () => {
    await expect(
      WikiLink(
        {
          sourceDocId: 99999,
          targetDocIds: [doc2Id],
        },
        { skipUI: true },
      ),
    ).rejects.toThrow(WikiError);

    await expect(
      WikiLink(
        {
          sourceDocId: 99999,
          targetDocIds: [doc2Id],
        },
        { skipUI: true },
      ),
    ).rejects.toThrow("源文档 99999 不存在");
  });

  it("不存在的目标文档抛出错误", async () => {
    await expect(
      WikiLink(
        {
          sourceDocId: doc1Id,
          targetDocIds: [99999],
        },
        { skipUI: true },
      ),
    ).rejects.toThrow(WikiError);

    await expect(
      WikiLink(
        {
          sourceDocId: doc1Id,
          targetDocIds: [99999],
        },
        { skipUI: true },
      ),
    ).rejects.toThrow("目标文档 99999 不存在");
  });

  it("无效的 sourceDocId 抛出错误", async () => {
    await expect(
      WikiLink(
        {
          sourceDocId: -1,
          targetDocIds: [doc2Id],
        },
        { skipUI: true },
      ),
    ).rejects.toThrow(WikiError);
  });

  it("无效的 targetDocIds 抛出错误", async () => {
    await expect(
      WikiLink(
        {
          sourceDocId: doc1Id,
          targetDocIds: [-1],
        },
        { skipUI: true },
      ),
    ).rejects.toThrow(WikiError);
  });

  it("不支持 skipUI=false 模式", async () => {
    await expect(
      WikiLink({
        sourceDocId: doc1Id,
        targetDocIds: [doc2Id],
      }),
    ).rejects.toThrow("仅支持 skipUI=true");
  });
});
