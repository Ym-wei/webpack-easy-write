#! /usr/bin/env node
// 使用node 编写代码

// 1.需要找到当前执行名的路径 拿到webpack.config.js文件配置
let { resolve } = require('path')

let config = require(resolve('webpack.config.js'))
let Compiler = require('./lib/Compiler')
let compiler = new Compiler(config)
compiler.run()

