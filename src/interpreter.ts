import { readFile } from 'fs'
import readline from 'readline'

const isDebug = process.env['DEBUG']

export type State = string
export type AlphabetSymbol = string
export type StackSymbol = string 
export interface Transition {
    fromState: State
    inputSymbol: AlphabetSymbol
    inputStackSymbols: StackSymbol[]
    toState: State
    outputStackSymbols: StackSymbol[]
}
export interface InterpreterConfiguration {
    states: State[]
    alphabetSymbols: AlphabetSymbol[]
    stackSymbols: StackSymbol[]
    initialState: State
    initialStackSymbol: StackSymbol
    acceptedStates: State[]
    acceptThroughEmptyStack: boolean
    transitions: Transition[]
}
export class Interpreter {
    config: InterpreterConfiguration
    stack: StackSymbol[]
    word: AlphabetSymbol[]

    constructor(configuration : InterpreterConfiguration) {
        this.config = configuration
        this.stack = []
        this.word = []
    }

    accepts(word: AlphabetSymbol[]): boolean {
        return true
    }
}

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
const parseAutomata = function(automataFile: Buffer|string, callback: (interpreter: Interpreter) => unknown) {
    // Parse automata configuration text
    const automataText = automataFile.toString()
    const [
        states,
        alphabetSymbols,
        stackSymbols,
        initialStates,
        initialStackSymbols,
        acceptedStates,
        acceptThroughEmptyStackSymbols,    
        ...transitionLines
    ] = automataText.trim().split('\n').map(line => line.trim().split(' ').map(word => word.trim()))
    
    // Extra parsing on transitions
    const transitions : Transition[] = transitionLines.map(transition => {
        const [fromState, inputSymbol, inputStackSymbolsSerialized, toState, outputStackSymbolsSerialized, ...other] = transition
        const inputStackSymbols = inputStackSymbolsSerialized.split('')
        const outputStackSymbols = outputStackSymbolsSerialized.split('')
        if (other.length > 0) throw new Error (`Transition line contains more data than needed: ${transition}`)
        return {
            fromState,
            inputSymbol,
            inputStackSymbols,
            toState,
            outputStackSymbols
        } as Transition
    })

    // Assertions on configuration
    if (initialStates.length !== 1) throw new Error("Initial state line should contain one state")
    const initialState = initialStates[0]
    
    if (initialStackSymbols.length !== 1) throw new Error("Initial stack symbol line should contain one state")
    const initialStackSymbol = initialStackSymbols[0]
    
    if (acceptThroughEmptyStackSymbols.length !== 1) throw new Error("Accept through emptying line should contain 'E' or 'F'")
    const acceptThroughEmptyStackSymbol = acceptThroughEmptyStackSymbols[0]
    let acceptThroughEmptyStack
    if (acceptThroughEmptyStackSymbol === 'E') {
        acceptThroughEmptyStack = true
    } else if (acceptThroughEmptyStackSymbol === 'F') {
        acceptThroughEmptyStack = true
    } else {
        throw new Error('Accept through stack emptying line should contain \'E\' or \'F\'')
    }
    
    // Create automata interpreter instance and its configuration
    const configuration : InterpreterConfiguration = {
        states,
        alphabetSymbols,
        stackSymbols,
        initialState,
        initialStackSymbol,
        acceptedStates,
        acceptThroughEmptyStack,
        transitions
    }
    const interpreter = new Interpreter(configuration)

    callback(interpreter)
}

// Automata read-eval-print loop
const replAutomata = function(automata: Interpreter) {
    if (isDebug) console.log('Configured automata {\n', automata.config, '}\n')
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
    if (isDebug) console.log(`Read automata {\n${automatadata}\n}`)
    parseAutomata(automatadata, (automata) => {
        replAutomata(automata)
    })
})