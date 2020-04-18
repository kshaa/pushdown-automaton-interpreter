import { readFile } from 'fs'
import readline from 'readline'

export class Interpreter {
    constructor() {}
}

const interpreter = new Interpreter()

// Parse program arguments and read automata file 
const readAutomata = function(callback: (automata: Buffer|string) => unknown) {
    if (process.argv.length !== 3) {
        console.log('Program expects one argument - magazine automata path')
        console.log(`Received ${process.argv.length} arguments: ${process.argv}`)
        process.exit(1)
    } else {
        const automatapath = process.argv[2]
        readFile(automatapath, (err, automatadata) => {
            if (err) {
                console.log(`Failed to read automata ${automatapath}: ${err}`)
            } else {
                callback(automatadata)
            }        
        })
    }
}

// Parse automata string and return an initialised Interpreter 
const parseAutomata = function(data: Buffer|string, callback: (interpreter: Interpreter) => unknown) {
    const interpreter = new Interpreter()
    callback(interpreter)
}

// Automata read-eval-print loop
const replAutomata = function(automata: Interpreter) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('Insert word for interpreter: ', (answer) => {
        console.log(`Read word: ${answer}`);
        rl.close();
    });
      
}

// Executable usage
readAutomata((automatadata) => {
    console.log(`Read automata {\n${automatadata}\n}`)
    parseAutomata(automatadata, (automata) => {
        replAutomata(automata)
    })
})