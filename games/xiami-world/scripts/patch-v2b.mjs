import { readFileSync, writeFileSync } from 'node:fs'
const P = 'docs/design/network-graph-v2.json'
const g = JSON.parse(readFileSync(P, 'utf8'))
const R = n => { const r = g.reactions.find(x => x.output === n); if (!r) throw new Error('缺: ' + n); return r }

// 每组区分料 + 规则更新
R('载波').inputs = ['电平', '时间', '时钟']
R('载波').rule = '一条纯正弦空车,周期性重复(时钟给它固定周期),恰有幅/频/相三个可独立调制的参数'

R('差分曼彻斯特编码').inputs = ['曼彻斯特编码']
R('差分曼彻斯特编码').rule = '在曼彻斯特基础上改判"开头跳没跳"表0/1(中点仍必跳保时钟),于是线接反了也照读不误'

R('FSK频移键控').inputs = ['载波', '比特', '时钟']
R('FSK频移键控').rule = '只拧频率旋钮:1高频0低频;快慢要靠时钟基准才分得出,振幅不变、抗噪强于ASK'

R('PSK相移键控').inputs = ['载波', '比特', '同步']
R('PSK相移键控').rule = '只拧相位旋钮:0°/180°;判相位得靠同步提供的相位基准(相干解调),又抗噪又能一格塞多比特'

R('组播地址').inputs = ['广播地址', '映射']
R('组播地址').rule = '在广播(喊全体)基础上用映射圈定一组:目的地址第一个字节I/G位=1,只有加入该组(01:00:5E)的网卡才收下'

R('校验和').inputs = ['奇偶校验', '比特']
R('校验和').rule = '把奇偶那一位的思路扩成整段按字加总求补,查得出更多位的错'

R('CRC').inputs = ['校验和', '时钟']
R('CRC').rule = '用生成多项式做移位除法(时钟驱动逐位移位),突发错也逃不掉,检错力远超校验和'

R('海明码').inputs = ['CRC', '映射']
R('海明码').rule = '多个校验位交叉覆盖(映射到具体数据位),不只查错、还能定位到哪一位错→当场纠正一位'

R('拥塞信号').inputs = ['定时器', '确认号机制', '尽力而为']
R('拥塞信号').rule = '网络是尽力而为的黑箱、堵没堵不会告诉你;只能隔箱嗅两种症状:超时、或同号ACK连回三次'

R('选择确认SACK').inputs = ['快速重传', '元数据']
R('选择确认SACK').rule = '在快速重传之上,用TCP选项(元数据)回报已收的非连续区块,重传只补真正缺的段'

writeFileSync(P, JSON.stringify(g, null, 2) + '\n', 'utf8')
console.log('patch-v2b 已写入')
