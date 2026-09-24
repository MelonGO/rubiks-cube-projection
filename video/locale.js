// Text used by the rendered demo. Keep timings and cube notation language-neutral.
export const ZH_CN = 'zh-CN';

const english = {
  title: 'Rubik’s Cube 2D',
  subtitle: 'A Rubik’s Cube, flattened into rings of dots',
  faces: { F: 'green side', U: 'yellow side', R: 'orange side' },
  captions: [
    { title: 'Every sticker is a dot', body: 'The 9 stickers on each side of the cube are 9 dots on the right.' },
    { title: 'Turn the cube, and the dots follow', body: 'When a side turns, its dots slide around a ring, in step with the cube.' },
  ],
  outroTitle: 'Try it yourself',
  outroBody: 'Turn the cube and watch the dots move with it.',
  credits: 'Made with three.js and cubejs  ·  video made with p5.js and Playwright',
  tour: [
    ['This is the app', 'The 3D cube on the left, its flat twin on the right'],
    ['Point at a face', 'Its 9 stickers light up as dots on the right'],
    ['Drag a face to turn it', 'The dots slide along a ring at the same time'],
    ['Drag empty space to look around', ''],
    ['Or press a letter key', 'U, D, L, R, F, B turn a face · Shift turns it back'],
    ['Made a mistake? Undo', ''],
    ['Scramble mixes it up', '25 random turns'],
    ['Solve fixes it', 'Watch both puzzles come back together'],
    ['Solved!', 'Every face one colour, every dot back home'],
  ],
  app: {
    scramble: 'Scramble', solve: 'Solve', preparing: 'Preparing solver…', solving: 'Solving…',
    undo: 'Undo', reset: 'Reset', solved: 'Solved',
    hint: 'Hover a face to highlight its dots · drag a face to turn · drag the background to orbit · keys <kbd>U D L R F B M E S</kbd> (<kbd>Shift</kbd> = inverse) · <kbd>X Y Z</kbd> rotate the cube · <kbd>⌘/Ctrl Z</kbd> undo',
  },
};

const chinese = {
  title: '二维魔方',
  subtitle: '把魔方展开成由彩色圆点组成的圆环',
  faces: { F: '绿色面', U: '黄色面', R: '橙色面' },
  captions: [
    { title: '每块贴纸都是一个圆点', body: '魔方每个面的 9 块贴纸，对应右侧的 9 个圆点。' },
    { title: '转动魔方，圆点也会跟着转', body: '转动一个面时，对应的圆点会沿圆环同步移动。' },
  ],
  outroTitle: '自己动手试试',
  outroBody: '转动魔方，看看圆点如何跟着移动。',
  credits: '使用 three.js 和 cubejs 制作 · 视频使用 p5.js 和 Playwright 制作',
  tour: [
    ['这是互动演示', '左侧是三维魔方，右侧是它的二维投影'],
    ['将鼠标指向一个面', '该面的 9 块贴纸会在右侧亮起'],
    ['拖动一个面来旋转', '圆点也会同时沿圆环移动'],
    ['拖动空白处，改变视角', ''],
    ['也可以按字母键', 'U、D、L、R、F、B 旋转对应面 · 按住 Shift 反向旋转'],
    ['操作错了？点击撤销', ''],
    ['点击打乱', '随机转动 25 次'],
    ['点击还原', '看看两种视图如何一起复原'],
    ['还原成功！', '每个面恢复同一种颜色，每个圆点回到原位'],
  ],
  app: {
    scramble: '打乱', solve: '还原', preparing: '正在准备求解器…', solving: '正在求解…',
    undo: '撤销', reset: '重置', solved: '已还原',
    hint: '将鼠标指向一个面以高亮圆点 · 拖动一个面来旋转 · 拖动背景来改变视角 · 按 <kbd>U D L R F B M E S</kbd> 转动（<kbd>Shift</kbd> 反向）· <kbd>X Y Z</kbd> 旋转整个魔方 · <kbd>⌘/Ctrl Z</kbd> 撤销',
  },
};

export function videoText(lang) {
  if (lang === ZH_CN) return chinese;
  if (lang === 'en') return english;
  throw new Error(`Unsupported video language: ${lang}`);
}
