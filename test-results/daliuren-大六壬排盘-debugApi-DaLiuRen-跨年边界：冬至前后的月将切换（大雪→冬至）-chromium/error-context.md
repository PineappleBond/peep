# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: daliuren.spec.ts >> 大六壬排盘 debugApi.DaLiuRen >> 跨年边界：冬至前后的月将切换（大雪→冬至）
- Location: e2e/daliuren.spec.ts:827:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - heading "紫微斗数" [level=1] [ref=e5]
    - generic [ref=e6]: 玄机排盘 · iztro 引擎 · 自研盘面
    - generic [ref=e8]:
      - combobox [ref=e9]:
        - option "演示 · 男" [selected]
      - button "+" [ref=e10] [cursor=pointer]
      - button "✎" [ref=e11] [cursor=pointer]
      - button "✕" [disabled] [ref=e12]
  - generic [ref=e13]:
    - generic [ref=e14]:
      - button "大限" [ref=e15] [cursor=pointer]
      - generic [ref=e16]:
        - button "童限 1~2岁" [ref=e17] [cursor=pointer]:
          - generic [ref=e18]: 童限
          - generic [ref=e19]: 1~2岁
        - button "3~12 壬午限" [ref=e20] [cursor=pointer]:
          - generic [ref=e21]: 3~12
          - generic [ref=e22]: 壬午限
        - button "13~22 癸未限" [ref=e23] [cursor=pointer]:
          - generic [ref=e24]: 13~22
          - generic [ref=e25]: 癸未限
        - button "23~32 甲申限" [ref=e26] [cursor=pointer]:
          - generic [ref=e27]: 23~32
          - generic [ref=e28]: 甲申限
        - button "33~42 乙酉限" [ref=e29] [cursor=pointer]:
          - generic [ref=e30]: 33~42
          - generic [ref=e31]: 乙酉限
        - button "43~52 丙戌限" [ref=e32] [cursor=pointer]:
          - generic [ref=e33]: 43~52
          - generic [ref=e34]: 丙戌限
        - button "53~62 丁亥限" [ref=e35] [cursor=pointer]:
          - generic [ref=e36]: 53~62
          - generic [ref=e37]: 丁亥限
        - button "63~72 戊子限" [ref=e38] [cursor=pointer]:
          - generic [ref=e39]: 63~72
          - generic [ref=e40]: 戊子限
        - button "73~82 己丑限" [ref=e41] [cursor=pointer]:
          - generic [ref=e42]: 73~82
          - generic [ref=e43]: 己丑限
        - button "83~92 戊寅限" [ref=e44] [cursor=pointer]:
          - generic [ref=e45]: 83~92
          - generic [ref=e46]: 戊寅限
        - button "93~102 己卯限" [ref=e47] [cursor=pointer]:
          - generic [ref=e48]: 93~102
          - generic [ref=e49]: 己卯限
        - button "103~112 庚辰限" [ref=e50] [cursor=pointer]:
          - generic [ref=e51]: 103~112
          - generic [ref=e52]: 庚辰限
        - button "113~122 辛巳限" [ref=e53] [cursor=pointer]:
          - generic [ref=e54]: 113~122
          - generic [ref=e55]: 辛巳限
    - generic [ref=e56]:
      - button "流年" [ref=e57] [cursor=pointer]
      - generic [ref=e58]:
        - button "2022 壬寅·23" [ref=e59] [cursor=pointer]:
          - generic [ref=e60]: "2022"
          - generic [ref=e61]: 壬寅·23
        - button "2023 癸卯·24" [ref=e62] [cursor=pointer]:
          - generic [ref=e63]: "2023"
          - generic [ref=e64]: 癸卯·24
        - button "2024 甲辰·25" [ref=e65] [cursor=pointer]:
          - generic [ref=e66]: "2024"
          - generic [ref=e67]: 甲辰·25
        - button "2025 乙巳·26" [ref=e68] [cursor=pointer]:
          - generic [ref=e69]: "2025"
          - generic [ref=e70]: 乙巳·26
        - button "2026 丙午·27" [ref=e71] [cursor=pointer]:
          - generic [ref=e72]: "2026"
          - generic [ref=e73]: 丙午·27
        - button "2027 丁未·28" [ref=e74] [cursor=pointer]:
          - generic [ref=e75]: "2027"
          - generic [ref=e76]: 丁未·28
        - button "2028 戊申·29" [ref=e77] [cursor=pointer]:
          - generic [ref=e78]: "2028"
          - generic [ref=e79]: 戊申·29
        - button "2029 己酉·30" [ref=e80] [cursor=pointer]:
          - generic [ref=e81]: "2029"
          - generic [ref=e82]: 己酉·30
        - button "2030 庚戌·31" [ref=e83] [cursor=pointer]:
          - generic [ref=e84]: "2030"
          - generic [ref=e85]: 庚戌·31
        - button "2031 辛亥·32" [ref=e86] [cursor=pointer]:
          - generic [ref=e87]: "2031"
          - generic [ref=e88]: 辛亥·32
    - generic [ref=e89]:
      - button "流月" [ref=e90] [cursor=pointer]
      - generic [ref=e91]:
        - button "正月 庚寅" [ref=e92] [cursor=pointer]:
          - generic [ref=e93]: 正月
          - generic [ref=e94]: 庚寅
        - button "二月 辛卯" [ref=e95] [cursor=pointer]:
          - generic [ref=e96]: 二月
          - generic [ref=e97]: 辛卯
        - button "三月 壬辰" [ref=e98] [cursor=pointer]:
          - generic [ref=e99]: 三月
          - generic [ref=e100]: 壬辰
        - button "四月 癸巳" [ref=e101] [cursor=pointer]:
          - generic [ref=e102]: 四月
          - generic [ref=e103]: 癸巳
        - button "五月 甲午" [ref=e104] [cursor=pointer]:
          - generic [ref=e105]: 五月
          - generic [ref=e106]: 甲午
        - button "六月 乙未" [ref=e107] [cursor=pointer]:
          - generic [ref=e108]: 六月
          - generic [ref=e109]: 乙未
        - button "七月 丙申" [ref=e110] [cursor=pointer]:
          - generic [ref=e111]: 七月
          - generic [ref=e112]: 丙申
        - button "八月 丁酉" [ref=e113] [cursor=pointer]:
          - generic [ref=e114]: 八月
          - generic [ref=e115]: 丁酉
        - button "九月 戊戌" [ref=e116] [cursor=pointer]:
          - generic [ref=e117]: 九月
          - generic [ref=e118]: 戊戌
        - button "十月 己亥" [ref=e119] [cursor=pointer]:
          - generic [ref=e120]: 十月
          - generic [ref=e121]: 己亥
        - button "冬月 庚子" [ref=e122] [cursor=pointer]:
          - generic [ref=e123]: 冬月
          - generic [ref=e124]: 庚子
        - button "腊月 辛丑" [ref=e125] [cursor=pointer]:
          - generic [ref=e126]: 腊月
          - generic [ref=e127]: 辛丑
    - generic [ref=e128]:
      - button "流日" [ref=e129] [cursor=pointer]
      - generic [ref=e130]:
        - button "初一 戊子" [ref=e131] [cursor=pointer]:
          - generic [ref=e132]: 初一
          - generic [ref=e133]: 戊子
        - button "初二 己丑" [ref=e134] [cursor=pointer]:
          - generic [ref=e135]: 初二
          - generic [ref=e136]: 己丑
        - button "初三 庚寅" [ref=e137] [cursor=pointer]:
          - generic [ref=e138]: 初三
          - generic [ref=e139]: 庚寅
        - button "初四 辛卯" [ref=e140] [cursor=pointer]:
          - generic [ref=e141]: 初四
          - generic [ref=e142]: 辛卯
        - button "初五 壬辰" [ref=e143] [cursor=pointer]:
          - generic [ref=e144]: 初五
          - generic [ref=e145]: 壬辰
        - button "初六 癸巳" [ref=e146] [cursor=pointer]:
          - generic [ref=e147]: 初六
          - generic [ref=e148]: 癸巳
        - button "初七 甲午" [ref=e149] [cursor=pointer]:
          - generic [ref=e150]: 初七
          - generic [ref=e151]: 甲午
        - button "初八 乙未" [ref=e152] [cursor=pointer]:
          - generic [ref=e153]: 初八
          - generic [ref=e154]: 乙未
        - button "初九 丙申" [ref=e155] [cursor=pointer]:
          - generic [ref=e156]: 初九
          - generic [ref=e157]: 丙申
        - button "初十 丁酉" [ref=e158] [cursor=pointer]:
          - generic [ref=e159]: 初十
          - generic [ref=e160]: 丁酉
        - button "十一 戊戌" [ref=e161] [cursor=pointer]:
          - generic [ref=e162]: 十一
          - generic [ref=e163]: 戊戌
        - button "十二 己亥" [ref=e164] [cursor=pointer]:
          - generic [ref=e165]: 十二
          - generic [ref=e166]: 己亥
        - button "十三 庚子" [ref=e167] [cursor=pointer]:
          - generic [ref=e168]: 十三
          - generic [ref=e169]: 庚子
        - button "十四 辛丑" [ref=e170] [cursor=pointer]:
          - generic [ref=e171]: 十四
          - generic [ref=e172]: 辛丑
        - button "十五 壬寅" [ref=e173] [cursor=pointer]:
          - generic [ref=e174]: 十五
          - generic [ref=e175]: 壬寅
        - button "十六 癸卯" [ref=e176] [cursor=pointer]:
          - generic [ref=e177]: 十六
          - generic [ref=e178]: 癸卯
        - button "十七 甲辰" [ref=e179] [cursor=pointer]:
          - generic [ref=e180]: 十七
          - generic [ref=e181]: 甲辰
        - button "十八 乙巳" [ref=e182] [cursor=pointer]:
          - generic [ref=e183]: 十八
          - generic [ref=e184]: 乙巳
        - button "十九 丙午" [ref=e185] [cursor=pointer]:
          - generic [ref=e186]: 十九
          - generic [ref=e187]: 丙午
        - button "二十 丁未" [ref=e188] [cursor=pointer]:
          - generic [ref=e189]: 二十
          - generic [ref=e190]: 丁未
        - button "廿一 戊申" [ref=e191] [cursor=pointer]:
          - generic [ref=e192]: 廿一
          - generic [ref=e193]: 戊申
        - button "廿二 己酉" [ref=e194] [cursor=pointer]:
          - generic [ref=e195]: 廿二
          - generic [ref=e196]: 己酉
        - button "廿三 庚戌" [ref=e197] [cursor=pointer]:
          - generic [ref=e198]: 廿三
          - generic [ref=e199]: 庚戌
        - button "廿四 辛亥" [ref=e200] [cursor=pointer]:
          - generic [ref=e201]: 廿四
          - generic [ref=e202]: 辛亥
        - button "廿五 壬子" [ref=e203] [cursor=pointer]:
          - generic [ref=e204]: 廿五
          - generic [ref=e205]: 壬子
        - button "廿六 癸丑" [ref=e206] [cursor=pointer]:
          - generic [ref=e207]: 廿六
          - generic [ref=e208]: 癸丑
        - button "廿七 甲寅" [ref=e209] [cursor=pointer]:
          - generic [ref=e210]: 廿七
          - generic [ref=e211]: 甲寅
        - button "廿八 乙卯" [ref=e212] [cursor=pointer]:
          - generic [ref=e213]: 廿八
          - generic [ref=e214]: 乙卯
        - button "廿九 丙辰" [ref=e215] [cursor=pointer]:
          - generic [ref=e216]: 廿九
          - generic [ref=e217]: 丙辰
    - generic [ref=e218]:
      - button "流时" [ref=e219] [cursor=pointer]
      - generic [ref=e220]:
        - button "子时 庚子" [ref=e221] [cursor=pointer]:
          - generic [ref=e222]: 子时
          - generic [ref=e223]: 庚子
        - button "丑时 辛丑" [ref=e224] [cursor=pointer]:
          - generic [ref=e225]: 丑时
          - generic [ref=e226]: 辛丑
        - button "寅时 壬寅" [ref=e227] [cursor=pointer]:
          - generic [ref=e228]: 寅时
          - generic [ref=e229]: 壬寅
        - button "卯时 癸卯" [ref=e230] [cursor=pointer]:
          - generic [ref=e231]: 卯时
          - generic [ref=e232]: 癸卯
        - button "辰时 甲辰" [ref=e233] [cursor=pointer]:
          - generic [ref=e234]: 辰时
          - generic [ref=e235]: 甲辰
        - button "巳时 乙巳" [ref=e236] [cursor=pointer]:
          - generic [ref=e237]: 巳时
          - generic [ref=e238]: 乙巳
        - button "午时 丙午" [ref=e239] [cursor=pointer]:
          - generic [ref=e240]: 午时
          - generic [ref=e241]: 丙午
        - button "未时 丁未" [ref=e242] [cursor=pointer]:
          - generic [ref=e243]: 未时
          - generic [ref=e244]: 丁未
        - button "申时 戊申" [ref=e245] [cursor=pointer]:
          - generic [ref=e246]: 申时
          - generic [ref=e247]: 戊申
        - button "酉时 己酉" [ref=e248] [cursor=pointer]:
          - generic [ref=e249]: 酉时
          - generic [ref=e250]: 己酉
        - button "戌时 庚戌" [ref=e251] [cursor=pointer]:
          - generic [ref=e252]: 戌时
          - generic [ref=e253]: 庚戌
        - button "亥时 辛亥" [ref=e254] [cursor=pointer]:
          - generic [ref=e255]: 亥时
          - generic [ref=e256]: 辛亥
  - generic [ref=e259]:
    - generic [ref=e260] [cursor=pointer]:
      - generic [ref=e261]:
        - generic [ref=e262]:
          - generic [ref=e263]:
            - generic [ref=e264]: 武曲
            - generic [ref=e265]: 得
            - generic [ref=e266]:
              - generic [ref=e267]: 权
              - generic [ref=e268]: 科
          - generic [ref=e269]:
            - generic [ref=e270]: 天相
            - generic [ref=e271]: 庙
          - generic [ref=e272]: 天马
        - generic [ref=e275]:
          - generic [ref=e276]: 解神
          - generic [ref=e277]: 三台
          - generic [ref=e278]: 天寿
          - generic [ref=e279]: 天巫
          - generic [ref=e280]: 天厨
          - generic [ref=e281]: 阴煞
          - generic [ref=e282]: 天哭
        - generic [ref=e283]:
          - generic [ref=e284]: 运禄
          - generic [ref=e285]: 运马
      - generic [ref=e287]:
        - generic [ref=e288]: 迁
        - generic [ref=e289]: 财
      - generic [ref=e290]:
        - generic [ref=e291]:
          - generic [ref=e292]: 临官
          - generic [ref=e293]: 飞廉
        - generic [ref=e294]:
          - generic [ref=e295]: 财帛
          - generic [ref=e296]: 83-92
          - generic "小限岁数：5 17 29 41 53 65 77 89 101 113" [ref=e297]: 5 17 29 41 53
        - generic [ref=e298]:
          - generic [ref=e299]:
            - generic [ref=e300]: 白虎
            - generic [ref=e301]: 指背
          - generic [ref=e302]: 戊寅
    - generic [ref=e303] [cursor=pointer]:
      - generic [ref=e304]:
        - generic [ref=e305]:
          - generic [ref=e306]:
            - generic [ref=e307]: 太阳
            - generic [ref=e308]: 庙
            - generic [ref=e309]:
              - generic [ref=e310]: 禄
              - generic [ref=e311]: 忌
          - generic [ref=e312]:
            - generic [ref=e313]: 天梁
            - generic [ref=e314]: 庙
            - generic "自化科（宫干四化入本宫·离心）" [ref=e316]: 科
        - generic [ref=e317]: 天刑
        - generic [ref=e319]: 运羊
        - generic [ref=e321]: 流喜
      - generic [ref=e323]:
        - generic [ref=e324]: 疾
        - generic [ref=e325]: 子
      - generic [ref=e326]:
        - generic [ref=e327]:
          - generic [ref=e328]: 帝旺
          - generic [ref=e329]: 喜神
        - generic [ref=e330]:
          - generic [ref=e331]: 子女
          - generic [ref=e332]: 93-102
          - generic "小限岁数：6 18 30 42 54 66 78 90 102 114" [ref=e333]: 6 18 30 42 54
        - generic [ref=e334]:
          - generic [ref=e335]:
            - generic [ref=e336]: 天德
            - generic [ref=e337]: 咸池
          - generic [ref=e338]: 己卯
    - generic [ref=e339] [cursor=pointer]:
      - generic [ref=e340]:
        - generic [ref=e341]:
          - generic [ref=e342]:
            - generic [ref=e343]: 七杀
            - generic [ref=e344]: 庙
          - generic [ref=e345]: 右弼
          - generic [ref=e348]:
            - generic [ref=e349]: 火星
            - generic [ref=e350]: 陷
        - generic [ref=e351]:
          - generic [ref=e352]: 封诰
          - generic [ref=e353]: 华盖
        - generic [ref=e354]:
          - generic [ref=e355]: 年解
          - generic [ref=e356]: 流陀
      - generic [ref=e358]:
        - generic [ref=e359]: 财
        - generic [ref=e360]: 夫
      - generic [ref=e361]:
        - generic [ref=e362]:
          - generic [ref=e363]: 衰
          - generic [ref=e364]: 病符
        - generic [ref=e365]:
          - generic [ref=e366]:
            - text: 夫妻
            - emphasis [ref=e367]: 来因
          - generic [ref=e368]: 103-112
          - generic "小限岁数：7 19 31 43 55 67 79 91 103 115" [ref=e369]: 7 19 31 43 55
        - generic [ref=e370]:
          - generic [ref=e371]:
            - generic [ref=e372]: 吊客
            - generic [ref=e373]: 月煞
          - generic [ref=e374]: 庚辰
    - generic [ref=e375] [cursor=pointer]:
      - generic [ref=e376]:
        - generic [ref=e378]:
          - generic [ref=e379]: 天机
          - generic [ref=e380]: 平
          - generic [ref=e381]: 权
        - generic [ref=e383]:
          - generic [ref=e384]: 天喜
          - generic [ref=e385]: 天空
          - generic [ref=e386]: 劫杀
          - generic [ref=e387]: 孤辰
        - generic [ref=e388]: 运昌
        - generic [ref=e390]: 流禄
      - generic [ref=e393]:
        - generic [ref=e394]: 子
        - generic [ref=e395]: 兄
      - generic [ref=e396]:
        - generic [ref=e397]:
          - generic [ref=e398]: 病
          - generic [ref=e399]: 大耗
        - generic [ref=e400]:
          - generic [ref=e401]: 兄弟
          - generic [ref=e402]: 113-122
          - generic "小限岁数：8 20 32 44 56 68 80 92 104 116" [ref=e403]: 8 20 32 44 56
        - generic [ref=e404]:
          - generic [ref=e405]:
            - generic [ref=e406]: 病符
            - generic [ref=e407]: 亡神
          - generic [ref=e408]: 辛巳
    - generic [ref=e409] [cursor=pointer]:
      - button "详" [ref=e410]
      - generic [ref=e411]:
        - generic [ref=e412]:
          - generic [ref=e413]:
            - generic [ref=e414]: 紫微
            - generic [ref=e415]: 庙
            - generic "自化权（宫干四化入本宫·离心）" [ref=e417]: 权
          - generic [ref=e418]:
            - generic [ref=e419]: 文曲
            - generic [ref=e420]: 陷
        - generic [ref=e421]:
          - generic [ref=e422]: 凤阁
          - generic [ref=e423]: 天福
          - generic [ref=e424]: 截空
          - generic [ref=e425]: 蜚廉
          - generic [ref=e426]: 年解
        - generic [ref=e427]:
          - generic [ref=e428]: 流曲
          - generic [ref=e429]: 流羊
      - generic [ref=e431]:
        - generic [ref=e432]: 夫
        - generic [ref=e433]: 命
      - generic [ref=e434]:
        - generic [ref=e435]:
          - generic [ref=e436]: 死
          - generic [ref=e437]: 伏兵
        - generic [ref=e438]:
          - generic [ref=e439]: 命宫
          - generic [ref=e440]: 3-12
          - generic "小限岁数：9 21 33 45 57 69 81 93 105 117" [ref=e441]: 9 21 33 45 57
        - generic [ref=e442]:
          - generic [ref=e443]:
            - generic [ref=e444]: 岁建
            - generic [ref=e445]: 将星
          - generic [ref=e446]: 壬午
    - generic [ref=e447] [cursor=pointer]:
      - generic [ref=e448]:
        - generic [ref=e449]:
          - generic [ref=e450]: 天钺
          - generic [ref=e453]:
            - generic [ref=e454]: 陀罗
            - generic [ref=e455]: 庙
        - generic [ref=e456]: 天姚
        - generic [ref=e458]:
          - generic [ref=e459]: 运钺
          - generic [ref=e460]: 运鸾
      - generic [ref=e462]:
        - generic [ref=e463]: 兄
        - generic [ref=e464]: 父
      - generic [ref=e465]:
        - generic [ref=e466]:
          - generic [ref=e467]: 墓
          - generic [ref=e468]: 官府
        - generic [ref=e469]:
          - generic [ref=e470]: 父母
          - generic [ref=e471]: 13-22
          - generic "小限岁数：10 22 34 46 58 70 82 94 106 118" [ref=e472]: 10 22 34 46 58
        - generic [ref=e473]:
          - generic [ref=e474]:
            - generic [ref=e475]: 晦气
            - generic [ref=e476]: 攀鞍
          - generic [ref=e477]: 癸未
    - generic [ref=e478] [cursor=pointer]:
      - generic [ref=e479]:
        - generic [ref=e480]:
          - generic [ref=e481]:
            - generic [ref=e482]: 破军
            - generic [ref=e483]: 得
            - generic [ref=e484]:
              - generic "自化权（宫干四化入本宫·离心）" [ref=e485]: 权
              - generic [ref=e486]: 权
              - generic "离心·大限权" [ref=e487]: 权
          - generic [ref=e488]:
            - generic [ref=e489]: 文昌
            - generic [ref=e490]: 得
            - generic [ref=e491]: 科
          - generic [ref=e493]: 禄存
        - generic [ref=e496]:
          - generic [ref=e497]: 龙池
          - generic [ref=e498]: 台辅
          - generic [ref=e499]: 旬空
        - generic [ref=e500]:
          - generic [ref=e501]: 流昌
          - generic [ref=e502]: 流马
      - generic [ref=e503]:
        - generic [ref=e504]: 命
        - generic [ref=e505]: 福
      - generic [ref=e506]:
        - generic [ref=e507]:
          - generic [ref=e508]: 绝
          - generic [ref=e509]: 博士
        - generic [ref=e510]:
          - generic [ref=e511]: 福德
          - generic [ref=e512]: 23-32
          - generic "小限岁数：11 23 35 47 59 71 83 95 107 119" [ref=e513]: 11 23 35 47 59
        - generic [ref=e514]:
          - generic [ref=e515]:
            - generic [ref=e516]: 丧门
            - generic [ref=e517]: 岁驿
          - generic [ref=e518]: 甲申
    - generic [ref=e519] [cursor=pointer]:
      - generic [ref=e520]:
        - generic [ref=e521]:
          - generic [ref=e522]: 地空
          - generic [ref=e525]:
            - generic [ref=e526]: 擎羊
            - generic [ref=e527]: 陷
        - generic [ref=e528]:
          - generic [ref=e529]: 咸池
          - generic [ref=e530]: 天贵
          - generic [ref=e531]: 月德
        - generic [ref=e532]: 运曲
        - generic [ref=e534]:
          - generic [ref=e535]: 流钺
          - generic [ref=e536]: 流鸾
      - generic [ref=e538]:
        - generic [ref=e539]: 父
        - generic [ref=e540]: 田
      - generic [ref=e541]:
        - generic [ref=e542]:
          - generic [ref=e543]: 胎
          - generic [ref=e544]: 力士
        - generic [ref=e545]:
          - generic [ref=e546]: 田宅
          - generic [ref=e547]: 33-42
          - generic "小限岁数：12 24 36 48 60 72 84 96 108 120" [ref=e548]: 12 24 36 48 60
        - generic [ref=e549]:
          - generic [ref=e550]:
            - generic [ref=e551]: 贯索
            - generic [ref=e552]: 息神
          - generic [ref=e553]: 乙酉
    - generic [ref=e554] [cursor=pointer]:
      - generic [ref=e555]:
        - generic [ref=e556]:
          - generic [ref=e557]:
            - generic [ref=e558]: 廉贞
            - generic [ref=e559]: 利
            - generic [ref=e560]:
              - generic "自化忌（宫干四化入本宫·离心）" [ref=e561]: 忌
              - generic [ref=e562]: 禄
              - generic [ref=e563]: 忌
          - generic [ref=e564]:
            - generic [ref=e565]: 天府
            - generic [ref=e566]: 庙
            - generic [ref=e567]: 科
          - generic [ref=e569]: 左辅
        - generic [ref=e572]:
          - generic [ref=e573]: 天才
          - generic [ref=e574]: 天虚
      - generic [ref=e576]:
        - generic [ref=e577]: 福
        - generic [ref=e578]: 官
      - generic [ref=e579]:
        - generic [ref=e580]:
          - generic [ref=e581]: 养
          - generic [ref=e582]: 青龙
        - generic [ref=e583]:
          - generic [ref=e584]:
            - text: 官禄
            - emphasis [ref=e585]: 身宫
          - generic [ref=e586]: 43-52
          - generic "小限岁数：1 13 25 37 49 61 73 85 97 109" [ref=e587]: 1 13 25 37 49
        - generic [ref=e588]:
          - generic [ref=e589]:
            - generic [ref=e590]: 官符
            - generic [ref=e591]: 华盖
          - generic [ref=e592]: 丙戌
    - generic [ref=e593] [cursor=pointer]:
      - generic [ref=e594]:
        - generic [ref=e596]:
          - generic [ref=e597]: 太阴
          - generic [ref=e598]: 庙
          - generic "自化禄（宫干四化入本宫·离心）" [ref=e600]: 禄
        - generic [ref=e601]:
          - generic [ref=e602]: 红鸾
          - generic [ref=e603]: 恩光
          - generic [ref=e604]: 天官
          - generic [ref=e605]: 天月
          - generic [ref=e606]: 龙德
          - generic [ref=e607]: 大耗
          - generic [ref=e608]: 天伤
        - generic [ref=e609]: 流魁
      - generic [ref=e612]:
        - generic [ref=e613]: 田
        - generic [ref=e614]: 友
      - generic [ref=e615]:
        - generic [ref=e616]:
          - generic [ref=e617]: 长生
          - generic [ref=e618]: 小耗
        - generic [ref=e619]:
          - generic [ref=e620]: 仆役
          - generic [ref=e621]: 53-62
          - generic "小限岁数：2 14 26 38 50 62 74 86 98 110" [ref=e622]: 2 14 26 38 50
        - generic [ref=e623]:
          - generic [ref=e624]:
            - generic [ref=e625]: 小耗
            - generic [ref=e626]: 劫煞
          - generic [ref=e627]: 丁亥
    - generic [ref=e628] [cursor=pointer]:
      - generic [ref=e629]:
        - generic [ref=e630]:
          - generic [ref=e631]:
            - generic [ref=e632]: 贪狼
            - generic [ref=e633]: 旺
            - generic "自化禄（宫干四化入本宫·离心）" [ref=e635]: 禄
          - generic [ref=e636]:
            - generic [ref=e637]: 铃星
            - generic [ref=e638]: 陷
        - generic [ref=e639]: 八座
      - generic [ref=e642]:
        - generic [ref=e643]: 官
        - generic [ref=e644]: 迁
      - generic [ref=e645]:
        - generic [ref=e646]:
          - generic [ref=e647]: 沐浴
          - generic [ref=e648]: 将军
        - generic [ref=e649]:
          - generic [ref=e650]: 迁移
          - generic [ref=e651]: 63-72
          - generic "小限岁数：3 15 27 39 51 63 75 87 99 111" [ref=e652]: 3 15 27 39 51
        - generic [ref=e653]:
          - generic [ref=e654]:
            - generic [ref=e655]: 岁破
            - generic [ref=e656]: 灾煞
          - generic [ref=e657]: 戊子
    - generic [ref=e658] [cursor=pointer]:
      - generic [ref=e659]:
        - generic [ref=e660]:
          - generic [ref=e661]:
            - generic [ref=e662]: 天同
            - generic [ref=e663]: 不
            - generic [ref=e664]:
              - generic [ref=e665]: 忌
              - generic [ref=e666]: 禄
          - generic [ref=e667]:
            - generic [ref=e668]: 巨门
            - generic [ref=e669]: 不
          - generic [ref=e670]: 天魁
          - generic [ref=e673]: 地劫
        - generic [ref=e676]:
          - generic [ref=e677]: 天德
          - generic [ref=e678]: 寡宿
          - generic [ref=e679]: 破碎
          - generic [ref=e680]: 天使
        - generic [ref=e681]:
          - generic [ref=e682]: 运魁
          - generic [ref=e683]: 运陀
          - generic [ref=e684]: 运喜
      - generic [ref=e686]:
        - generic [ref=e687]: 友
        - generic [ref=e688]: 疾
      - generic [ref=e689]:
        - generic [ref=e690]:
          - generic [ref=e691]: 冠带
          - generic [ref=e692]: 奏书
        - generic [ref=e693]:
          - generic [ref=e694]: 疾厄
          - generic [ref=e695]: 73-82
          - generic "小限岁数：4 16 28 40 52 64 76 88 100 112" [ref=e696]: 4 16 28 40 52
        - generic [ref=e697]:
          - generic [ref=e698]:
            - generic [ref=e699]: 龙德
            - generic [ref=e700]: 天煞
          - generic [ref=e701]: 己丑
    - generic [ref=e702]:
      - generic [ref=e703]:
        - heading "紫微斗数" [level=2] [ref=e704]
        - generic [ref=e705]: ZI WEI · 玄机盘
      - generic [ref=e706]:
        - generic [ref=e707]:
          - generic [ref=e708]: 命造
          - generic [ref=e709]: 演示 · 乾造 阳男
        - generic [ref=e710]:
          - generic [ref=e711]: 五行局
          - generic [ref=e712]: 木三局 · 3岁上运
        - generic [ref=e713]:
          - generic [ref=e714]: 阳历
          - generic [ref=e715]: 2000-08-16
        - generic [ref=e716]:
          - generic [ref=e717]: 农历
          - generic [ref=e718]: 二〇〇〇年七月十七
        - generic [ref=e719]:
          - generic [ref=e720]: 时辰
          - generic [ref=e721]: 寅时（03:00~05:00）
        - generic [ref=e722]:
          - generic [ref=e723]: 生肖·星座
          - generic [ref=e724]: 龙 · 狮子座
        - generic [ref=e725]:
          - generic [ref=e726]: 命主·身主
          - generic [ref=e727]: 廉贞 · 文昌
        - generic [ref=e728]:
          - generic [ref=e729]: 命宫·身宫
          - generic [ref=e730]: 午 · 戌
        - generic [ref=e731]:
          - generic [ref=e732]: 来因宫
          - generic [ref=e733]: 夫妻（辰）
      - generic [ref=e734]:
        - generic [ref=e735]:
          - generic [ref=e736]: 年
          - generic [ref=e737]: 庚
          - generic [ref=e738]: 辰
        - generic [ref=e739]:
          - generic [ref=e740]: 月
          - generic [ref=e741]: 甲
          - generic [ref=e742]: 申
        - generic [ref=e743]:
          - generic [ref=e744]: 日
          - generic [ref=e745]: 丙
          - generic [ref=e746]: 午
        - generic [ref=e747]:
          - generic [ref=e748]: 时
          - generic [ref=e749]: 庚
          - generic [ref=e750]: 寅
      - generic [ref=e751]:
        - generic [ref=e752]: 观测
        - text: 公历 2026-9-25 · 农历 二〇二六年八月十五 · 戌时 · 虚岁27
      - generic [ref=e753]:
        - button "本" [ref=e754] [cursor=pointer]
        - button "限" [ref=e755] [cursor=pointer]
        - button "年" [ref=e756] [cursor=pointer]
        - button "月" [ref=e757] [cursor=pointer]
        - button "日" [ref=e758] [cursor=pointer]
        - button "时" [ref=e759] [cursor=pointer]
        - button "今" [ref=e760] [cursor=pointer]
        - button "飞" [ref=e761] [cursor=pointer]
        - button "化" [ref=e762] [cursor=pointer]
  - contentinfo [ref=e763]:
    - text: 算法引擎
    - link "iztro" [ref=e764] [cursor=pointer]:
      - /url: https://github.com/SylarLong/iztro
    - text: · 盘面 react-zwds · 星盘仅供学习研究
```

# Test source

```ts
  749 |     if (result.heavenBoard[0] === 6) {
  750 |       // 天地盘每支对冲
  751 |       for (let i = 0; i < 12; i++) {
  752 |         expect(result.heavenBoard[i]).toBe((i + 6) % 12);
  753 |       }
  754 |       // 三传方法应为返吟相关
  755 |       expect(result.threeTransmissions.method).toMatch(/返吟/);
  756 |     }
  757 |   });
  758 | 
  759 |   test("闰月年份：闰月不影响月将计算", async ({ page }) => {
  760 |     await page.goto("/");
  761 |     await page.waitForLoadState("networkidle");
  762 | 
  763 |     // 2023年有闰二月，验证闰二月期间的月将正常
  764 |     const result = await page.evaluate(async () => {
  765 |       // @ts-ignore
  766 |       if (!window.peep.DaLiuRen) {
  767 |         throw new Error("window.peep.DaLiuRen 未注册");
  768 |       }
  769 |       // 2023年闰二月（公历3月22日-4月19日），春分后月将为戌
  770 |       // @ts-ignore
  771 |       const r1 = await window.peep.DaLiuRen("2023-04-01", "12:00");
  772 |       // 2023年正常二月（公历3月1日-3月21日），春分前月将为亥
  773 |       // @ts-ignore
  774 |       const r2 = await window.peep.DaLiuRen("2023-03-15", "12:00");
  775 | 
  776 |       return { leap: r1, normal: r2 };
  777 |     });
  778 | 
  779 |     // 月将应在各自节气范围内正常
  780 |     expect(result.leap.monthGeneral.branch).toBe(10); // 春分后→戌
  781 |     expect(result.normal.monthGeneral.branch).toBe(11); // 雨水后春分前→亥
  782 |   });
  783 | 
  784 |   test("八专日：三传可能全部相同（独足格）", async ({ page }) => {
  785 |     await page.goto("/");
  786 |     await page.waitForLoadState("networkidle");
  787 | 
  788 |     // 八专日：干支同位（甲寅、乙卯、丙午、丁未、戊午、己未、庚申、辛酉、壬子、癸亥等）
  789 |     const result = await page.evaluate(async () => {
  790 |       // @ts-ignore
  791 |       if (!window.peep.DaLiuRen) {
  792 |         throw new Error("window.peep.DaLiuRen 未注册");
  793 |       }
  794 |       // 尝试多个八专日
  795 |       const dates = [
  796 |         { date: "2024-02-10", time: "12:00" }, // 可能是八专日
  797 |         { date: "2024-03-15", time: "12:00" },
  798 |         { date: "2024-05-20", time: "12:00" },
  799 |         { date: "2024-08-25", time: "12:00" },
  800 |       ];
  801 | 
  802 |       const results = await Promise.all(
  803 |         dates.map(({ date, time }) =>
  804 |           // @ts-ignore
  805 |           window.peep.DaLiuRen(date, time)
  806 |         )
  807 |       );
  808 | 
  809 |       // 找三传全同的（独足格）
  810 |       const duplicates = results.filter(
  811 |         (r: any) =>
  812 |           r.threeTransmissions.initial === r.threeTransmissions.middle &&
  813 |           r.threeTransmissions.middle === r.threeTransmissions.final
  814 |       );
  815 | 
  816 |       return {
  817 |         allMethods: results.map((r: any) => r.threeTransmissions.method),
  818 |         duplicateCount: duplicates.length,
  819 |       };
  820 |     });
  821 | 
  822 |     // 至少应有一个产生八专/独足或涉害缀瑕
  823 |     // （八专日不一定走八专路径，取决于四课有克情况）
  824 |     expect(result.allMethods.length).toBe(4);
  825 |   });
  826 | 
  827 |   test("跨年边界：冬至前后的月将切换（大雪→冬至）", async ({ page }) => {
  828 |     await page.goto("/");
  829 |     await page.waitForLoadState("networkidle");
  830 | 
  831 |     const result = await page.evaluate(async () => {
  832 |       // @ts-ignore
  833 |       if (!window.peep.DaLiuRen) {
  834 |         throw new Error("window.peep.DaLiuRen 未注册");
  835 |       }
  836 |       // 2023年大雪约12月7日，冬至约12月22日
  837 |       // 大雪后冬至前→月将=寅(2)；冬至后→月将=子(0)
  838 |       // @ts-ignore
  839 |       const before = await window.peep.DaLiuRen("2023-12-15", "12:00");
  840 |       // @ts-ignore
  841 |       const after = await window.peep.DaLiuRen("2023-12-25", "12:00");
  842 | 
  843 |       return { before, after };
  844 |     });
  845 | 
  846 |     // 大雪后冬至前→寅(2)
  847 |     expect(result.before.monthGeneral.branch).toBe(2);
  848 |     // 冬至后→子(0)
> 849 |     expect(result.after.monthGeneral.branch).toBe(0);
      |                                              ^ Error: expect(received).toBe(expected) // Object.is equality
  850 |   });
  851 | 
  852 |   // 第五阶段：毕法规则
  853 |   test("毕法规则：应识别毕法赋前六法", async ({ page }) => {
  854 |     await page.goto("/");
  855 |     await page.waitForLoadState("networkidle");
  856 | 
  857 |     const result = await page.evaluate(async () => {
  858 |       // @ts-ignore
  859 |       if (!window.peep?.DaLiuRen) {
  860 |         throw new Error("window.peep.DaLiuRen 未注册");
  861 |       }
  862 |       // @ts-ignore
  863 |       return await window.peep.DaLiuRen("2024-06-15", "12:00");
  864 |     });
  865 | 
  866 |     // 应有 biFa 字段
  867 |     expect(result.biFa).toBeDefined();
  868 |     expect(Array.isArray(result.biFa)).toBe(true);
  869 | 
  870 |     // 每个匹配项都有 rule 和 evidence
  871 |     for (const match of result.biFa) {
  872 |       expect(match).toHaveProperty("rule");
  873 |       expect(match).toHaveProperty("evidence");
  874 |       expect(match.rule).toHaveProperty("code");
  875 |       expect(match.rule).toHaveProperty("name");
  876 |       expect(match.rule).toHaveProperty("description");
  877 |       expect(Array.isArray(match.evidence)).toBe(true);
  878 |       expect(match.evidence.length).toBeGreaterThan(0);
  879 |     }
  880 | 
  881 |     // 已注册规则数应为 6
  882 |     const codeSet = new Set(result.biFa.map((m: any) => m.rule.code));
  883 |     // 所有可能的 code 都应是 bifa.01~bifa.06 之一
  884 |     for (const code of codeSet) {
  885 |       expect(/^bifa\.0[1-6]$/.test(code)).toBe(true);
  886 |     }
  887 | 
  888 |     // 多个日期测试，应覆盖至少 1 个毕法规则命中
  889 |     const multipleResults = await page.evaluate(async () => {
  890 |       const testCases = [
  891 |         { date: "2024-06-15", time: "12:00" },
  892 |         { date: "2024-01-01", time: "08:00" },
  893 |         { date: "2024-03-20", time: "14:00" },
  894 |         { date: "2024-06-21", time: "10:00" },
  895 |         { date: "2024-09-23", time: "16:00" },
  896 |         { date: "2024-12-21", time: "20:00" },
  897 |         { date: "2025-02-10", time: "09:00" },
  898 |         { date: "2025-05-05", time: "15:00" },
  899 |       ];
  900 |       return Promise.all(
  901 |         testCases.map(({ date, time }) =>
  902 |           // @ts-ignore
  903 |           window.peep.DaLiuRen(date, time)
  904 |         )
  905 |       );
  906 |     });
  907 | 
  908 |     let totalMatches = 0;
  909 |     const allBiFaCodes = new Set<string>();
  910 |     for (const r of multipleResults) {
  911 |       totalMatches += r.biFa.length;
  912 |       for (const m of r.biFa) {
  913 |         allBiFaCodes.add(m.rule.code);
  914 |       }
  915 |     }
  916 |     // 至少应命中 1 次（六个日期覆盖多种盘面）
  917 |     expect(totalMatches).toBeGreaterThanOrEqual(1);
  918 |   });
  919 | });
  920 | 
```