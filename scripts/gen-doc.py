# -*- coding: utf-8 -*-
import re,io
src=open('index.html',encoding='utf-8').read()
# 卡
cards={}
for m in re.finditer(r"def\('(\w+)','([^']+)',(\d+),'(\w+)','([^']*)'",src):
    i,nm,co,tg,note=m.groups();cards[i]=dict(name=nm,cost=int(co),tag=tg,note=note,
        ex=bool(re.search(r"def\('%s'.*?,1\)\s*$"%i,src,re.M)))
# 一次性(exhaust)判定:def 行以 ,1) 结尾
for i in cards:
    line=[l for l in src.split('\n') if l.startswith("def('%s'"%i)][0]
    cards[i]['ex']=line.rstrip().endswith(',1)')
KITS=dict(re.findall(r"(\w+):\[([^\]]*)\]",re.search(r"const KITS=\{(.*?)\}\n",src,re.S).group(1)))
KITS={k:[x.strip().strip("'") for x in v.split(',') if x.strip()] for k,v in KITS.items()}
STARTER=[x.strip("'") for x in re.search(r"const STARTER=\[([^\]]*)\]",src).group(1).split(',')]
# 敌人
foes={}
for m in re.finditer(r"^ (\w+):\s*\{([^}]*)\}",src,re.M):
    body=m.group(2)
    if "name:" not in body or "kind:" not in body: continue
    d={}
    for k,v in re.findall(r"(\w+):('[^']*'|[\d.]+)",body): d[k]=v.strip("'")
    foes[m.group(1)]=d
def row(i):
    c=cards[i];return "| %s | %d%s | %s |"%(c['name'],c['cost'],' · **一次性**' if c['ex'] else '',c['note'])
def kit(k,title,intro):
    o=["### %s\n"%title]
    if intro:o.append("> %s\n"%intro)
    o.append("| 卡 | 步 | 效果(**逐字取自代码**) |\n|---|:-:|---|")
    seen=[]
    for i in KITS[k]:
        if i in seen:continue
        seen.append(i)
        n=KITS[k].count(i)
        o.append(row(i).replace('| '+cards[i]['name']+' |','| %s%s |'%(cards[i]['name'],' ×%d'%n if n>1 else '')))
    return '\n'.join(o)+'\n'
out=[]
out.append("### 3.1 起始牌组(10 张,故意平庸)\n")
out.append("| 卡 | 份 | 效果 |\n|---|:-:|---|")
for i in dict.fromkeys(STARTER):
    out.append("| %s | %d | %s |"%(cards[i]['name'],STARTER.count(i),cards[i]['note']))
out.append("")
out.append(kit('sort','3.2 流派一 · 排序 → 查找(秩序流)','先整理再动手。前期慢,整理好之后每一击都放大。'))
out.append(kit('dc','3.3 流派二 · 分治 → 逐层(拆解流)','切段,然后每段同时处理。'))
out.append(kit('memo','3.4 流派三 · 预处理 → 查表(复利流)','一次投入,永久收益。前期最弱,后期最强。'))
out.append("> **「查表不消耗预处理值」是这条流派的命门。** 早期写成消耗品时它比基础卡差 4 倍,胜率 3%。\n")
out.append(kit('greedy','3.5 流派四 · 贪心 → 近似(激进流)','不求最优,只求现在最好。快,但欠债 —— 每点债务回合末额外 −2 预算。'))
out.append("### 3.6 通用工具(奖励池独有)\n")
out.append("| 卡 | 步 | 效果 |\n|---|:-:|---|")
for i in ['prune','backtrack','guard','hash']: out.append(row(i))
out.append("")
out.append("> **剪枝是 Boss 的唯一解。** 不带剪枝打「指数爆炸」:分治/预处理 0%、排序 11%。")
out.append("")
out.append("---\n")
out.append("## 4. 敌人(11 种 + 6 失误,**本表由 `npm run doc` 从 `index.html` 生成**)\n")
out.append("**三类必须分清:问题是本体,失误是干扰,对抗性输入是精英。**\n")
out.append("> 表中 N 是 **depth 0 的基准值**,实战按 `n × (1 + 0.085 × depth)` 放大。\n")
def ftable(kind,title,extra=''):
    o=["### %s\n"%title]
    if extra:o.append(extra+"\n")
    o.append("| 敌人 | N | 涌入 | 性质(**逐字取自代码**) |\n|---|:-:|:-:|---|")
    for k,d in foes.items():
        if d.get('kind')!=kind:continue
        o.append("| %s | %s | %s | %s |"%(d['name'],d['n'],d.get('inflow','0'),d.get('note','')))
    return '\n'.join(o)+'\n'
out.append(ftable('小怪','4.1 第一类 · 问题(战斗本体,岔口从这里抽两个)'))
out.append("### 4.2 第二类 · 失误(关卡环境效果,不是独立敌人)\n")
out.append("挂在关卡上,概率 `min(0.8, 0.35 + 0.07×关号)`,第 1 关不挂。挂了的关卡**预算 +10** 作为补偿(见坑 #11)。\n")
out.append("| 失误 | 效果(**逐字取自代码**) |\n|---|---|")
for m in re.finditer(r"^ (\w+):\s*\{name:'([^']+)',\s*note:'([^']+)'\}",src,re.M):
    out.append("| %s | %s |"%(m.group(2),m.group(3)))
out.append("")
out.append(ftable('精英','4.3 第三类 · 对抗性输入(精英,不设岔口)','**没有这一层,流派就只是皮肤。** 五个精英 = 四个专克 + 一个通用。'))
out.append(ftable('Boss','4.4 Boss'))
out.append("---\n")
new='\n'.join(out)
doc=open('docs/design.md',encoding='utf-8').read()
a=doc.index("### 3.1 起始牌组");b=doc.index("## 5. RUN 结构")
open('docs/design.md','w',encoding='utf-8').write(doc[:a]+new+'\n'+doc[b:])
print("已生成 %d 张卡 / %d 个敌人"%(len(cards),len(foes)))
