const isDev = !Boolean(this.document);

let fs = isDev ? require('fs') : null;
if(isDev) {
  // 获取源代码
  const codeSource = fs.readFileSync('./code_source.rpy').toString();
  // 解析代码，提取内容
  const { parseResult, contentList } = rpy2content(codeSource);
  const translateRowText = contentList.map(content => content.textContent).join('\n');
  fs.writeFileSync('./translate_source.txt', translateRowText);
  /* 中间是通过deepl翻译原文，将翻译结果放入translate_result中 */
  // 获取翻译内容，合并输出
  const translateString = fs.readFileSync('./translate_result.txt').toString();
  const translateList = translateString.replace(/\r/g, '').split('\n');
  const codeTarget = translate2code(translateList, contentList, parseResult);
  fs.writeFileSync('./code_target.rpy', codeTarget);
} else {
  // 注入输入框
  const parent = document.querySelector('.lmt__text');
  const trueArea = document.querySelector('.lmt__sides_container');
  const root = document.createElement('div');
  root.className = 'lmt__sides_container';
  root.style = "display: flex";
  root.innerHTML = `
    <div class="lmt__side_container lmt__side_container--source">
      <div class="lmt__textarea_container" style="padding: 10px">
        <div style="padding-bottom: 10px">输入源码</div>
        <div class="lmt__inner_textarea_container">
          <textarea class="lmt__textarea lmt__source_textarea lmt__textarea_base_style"
            style="font-size: 14px;overflow-y: scroll;"></textarea>
        </div>
      </div>
    </div>
    <div class="lmt__side_container lmt__side_container--target">
      <div class="lmt__textarea_container" style="padding: 20px">
      <div style="padding-bottom: 10px">翻译后转换的源码</div>
        <div class="lmt__inner_textarea_container">
          <textarea class="lmt__textarea lmt__source_textarea lmt__textarea_base_style"
            style="font-size: 14px;overflow-y: scroll;"></textarea>
        </div>
      </div>
    </div>
  `;
  parent.insertBefore(root, trueArea);
  const [area1, area2, area3, area4] = document.querySelectorAll('textarea');
  // 监听原代码区内容变化
  let parseResult = null;
  let contentList = null;
  area1.addEventListener('input', (e) => {
    // 处理后注入到翻译原文区
    console.log('检测到新源码输入，开始解析源码');
    const value = e.target.value;
    const { parseResult: _parseResult, contentList: _contentList } = rpy2content(value);
    [parseResult, contentList] = [_parseResult, _contentList];
    console.log('源码解析结果:', parseResult);
    const translateRowText = contentList.map(content => content.textContent).join('\n');
    area3.value = translateRowText;
    console.log('提取的内容:', contentList);
    // 发起输入事件触发翻译
    const fakeEvent = document.createEvent('HTMLEvents');
    fakeEvent.initEvent('input');
    area3.dispatchEvent(fakeEvent);
    console.log('开始翻译...');
  });
  // 轮询翻译后的结果
  let translateResult = null;
  setInterval(() => {
    const value = area4.value;
    // 新翻译结果
    const translateList = value ? value.replace(/\r/g, '').split('\n') : [];
    if(contentList.length !== translateList.length) {
      console.log(`原文有${contentList.length}句，翻译有${translateList.length}句，等待继续翻译中...`);
      return;
    }
    // 生成一次代码后，在更新源码前都不会再生成代码
    if(translateResult != value) {
      translateResult = value;
      if(contentList.length === 0) {
        console.log('原文中没有有效renpy翻译句段，请重新输入');
        return;
      }
      console.log('翻译完成，翻译后的内容:', translateList);
      console.log('开始转换为新代码');
      const code = translate2code(translateList, contentList, parseResult);
      area2.value = code;
      console.log('处理完成');
    }
  }, 2000);
}

// 解析rpy脚本，得出解析结果和内容
function rpy2content (rowString) {
  // 处理文本，按行拆分，过滤空行，去除首空
  const rowText = rowString.replace(/\r/g, '').split('\n').filter(line => line);
  const text = rowText.map(line => line.trim());
  
  // 判断每行文本的类型
  const typeTestList = [
    {
      type: '0原文位置',
      regex: /^# game\/(.*).rpy:(\d*)$/,
    },
    {
      type: '1翻译标记',
      regex: /^translate (\w*) (\w*):$/,
    },
    {
      type: '2原文',
      regex: /^# (\w* )?"(.*)"$/,
    },
    {
      type: '3旧翻译',
      regex: /^(.* )?"(.*)"$/,
    },
  ];
  function judgeType(line) {
    for(const typeTest of typeTestList) {
      if(typeTest.regex.test(line)) {
        return typeTest.type;
      }
    }
    return '未知';
  }
  // 解析原文
  const parseResult = text.map((line, index) => {
    const type = judgeType(line);
    if(type === '2原文') {
      const start = line.indexOf('"');
      const trueText = line.slice(start + 1, line.length - 1);
      return {
        type,
        source: rowText[index],
        text: line,
        textPrefix: line.slice(2, start),
        textContent: trueText,
        translate: '',
      };
    }
    return {
      type,
      source: rowText[index],
      text: line,
    };
  });
  // 循环步骤，生成结果
  let step = null;
  const contentList = [];
  parseResult.forEach(result => {
    const nextStep = Number(result.type[0]);
    // 新的一句
    if(nextStep == 0) {
      step = 0;
      return;
    }
    // 递进到下一句
    if(nextStep == step + 1){
      step += 1;
      if(step == 2) {
        contentList.push(result);
      }
      return;
    }
    // 没有成功递进到下一句，等待0开始下一句
    step = null;
    return;
  });
  return {
    parseResult,
    contentList,
  }
}

// 将翻译结果还原为代码
function translate2code (translateList, contentList, parseResult) {
  contentList.forEach((content, index) => {
    content.translate = translateList[index];
  });
  let lastIsSource = false;
  const finalString = parseResult.map(({ type, source, translate, textPrefix }, index) => {
    if(type === '2原文') {
      lastIsSource = true;
      return `\n${source}\n    ${textPrefix}"${translate}"\n`;
    }
    // 如果上一句原文已经有新翻译了，就不使用旧翻译
    if(type === '3旧翻译' && lastIsSource) {
      lastIsSource = false;
      return;
    }
    lastIsSource = false;
    return source;
  }).filter(line => line).join('\n');
  return finalString;
}
