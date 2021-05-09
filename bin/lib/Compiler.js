// 路径模块
let path = require('path')
// 文件模块
let fs = require('fs')
// parse 方法需要用
// 1. babylon 主要把源码转换成ast树
// 2. @babel/traverse
// 3. @babel/types
// 4. @babel/generator
let babylon = require('babylon')
let traverse = require('@babel/traverse').default
let t = require('@babel/types')
let generator = require('@babel/generator').default
// ejs 模板包
let ejs = require('ejs')
class Compiler {
  constructor(config) {
    // 缓存配置
    this.config = config
    // 需要保存入口文件的路径
    this.entryId = '' // ./src/index.js
    // 需要保存所有的模块依赖
    this.modules = {}
    // 入口
    this.entry = config.entry
    // 执行着的路径, 工作路径
    this.root = process.cwd()
  }

  // 运行起来
  run() {
    // 执行, 并且创建模块的依赖关系
    this.buildModule(path.resolve(this.root, this.entry), true)
    // 发射一个文件, 打包后的文件
    this.emitFile()
  }

  // 获取源码
  getSource(path) {
    let rules = this.config.module.rules
    let content = fs.readFileSync(path, 'utf-8')
    for (let i = 0; i < rules.length; i++) {
      const { use, test } = rules[i]
      let len = use.length - 1
      if (test.test(path)) {
        function normalLoader() {
          let loader = require(use[len--])
          content = loader(content)
          if(len >= 0) {
            normalLoader()
          }
        }
        normalLoader()
      }
    }
    return content
  }

  // 创建模块依赖
  // modulePath 模块的路径
  // isEntry 是否为入口
  buildModule(modulePath, isEntry) {
    // 拿到模块的内容
    let source = this.getSource(modulePath)
    // module key  相对路径
    let moduleName = `./${path.relative(this.root, modulePath)}`

    if (isEntry) {
      this.entryId = moduleName
    }
    // 解析需要把source源码进行改造
    let { sourceCode, dependencies } = this.parse(source, path.dirname(moduleName))
    this.modules[moduleName] = sourceCode

    // 递归查找所有模块
    dependencies.forEach(dep => {
      this.buildModule(
        // 拼接绝对路径
        path.join(this.root, dep),
        //不是根模块
        false
      )
    })
  }

  // 解析源码
  parse(source, parentPath) {
    // ast解析语法树
    let ast = babylon.parse(source)
    let dependencies = []
    traverse(ast, {
      CallExpression(p) {
        let { node } = p
        if (node.callee.name === 'require') {
          node.callee.name = '__webpack_require__'
          let moduleName = node.arguments[0].value
          moduleName = moduleName + (path.extname(moduleName) ? '' : '.js')
          moduleName = `./${path.join(parentPath, moduleName)}`
          dependencies.push(moduleName)
          node.arguments = [t.stringLiteral(moduleName)]
        }
      }
    })
    let sourceCode = generator(ast).code
    return {
      sourceCode,
      dependencies
    }
  }

  // 创建一个打包后的文件
  emitFile() {
    // 使用ejs模块发射文件
    // 1. 拿到输出文件路径
    let main = path.join(this.config.output.path, this.config.output.filename)
    let templateString = this.getSource(
      path.join(__dirname, 'main.ejs')
    )
    let code = ejs.render(templateString, {
      entryId: this.entryId,
      modules: this.modules
    })
    this.assets = {}
    this.assets[main] = code
    fs.writeFileSync(main, this.assets[main])
  }
}

module.exports = Compiler
