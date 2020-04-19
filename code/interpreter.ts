// Author: Krišjānis Veinbahs
// Student ID: kv18042
// Description: Magazine automata interpreter

import { readFile } from 'fs'
import readline from 'readline'
import { inspect } from 'util'

// Check if running in debug mode
const isDebug = process.env['DEBUG']

// Maximum amount of automata ticks allowed
const environmentMaxTicksSerialized = process.env['MAX_TICKS']
let environmentMaxTicks = 2000
if (environmentMaxTicksSerialized && environmentMaxTicksSerialized.length > 0) {
    console.log(environmentMaxTicksSerialized)
    environmentMaxTicks = Number(environmentMaxTicksSerialized)
}

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

// An interpreter definition describes what this automata can read
// what can it hold in the stack and how it can transition
export interface InterpreterDefinition {
    states: State[]
    alphabetSymbols: AlphabetSymbol[]
    stackSymbols: StackSymbol[]
    initialState: State
    initialStackSymbol: StackSymbol
    acceptedStates: State[]
    acceptThroughEmptyStack: boolean
    transitions: Transition[]
}

// An interpreter configuration describes a specific state in which
// the automata is in
export interface InterpreterConfiguration {
    stack: StackSymbol[]
    word: AlphabetSymbol[]
    state: State
}

// Error specifically for when interpreter reaches tick limit
export class TickLimitError extends Error {}

// An interpreter configuration set contains unique configurations
// This is used to automatically avoid storing duplicates
// Note: Set is a native class, I'm extending it for InterpreterConfiguration
export class ConfigurationSet extends Set<InterpreterConfiguration> {
    has(searchConfig: InterpreterConfiguration): boolean {
        // Helper function for checking array equality
        // Src: https://stackoverflow.com/a/16436975
        const arraysEqual = (a: unknown[], b: unknown[]): boolean => {
            if (a === b) return true
            if (a == null || b == null) return false
            if (a.length !== b.length) return false
            for (let i = 0; i < a.length; ++i) {
                if (a[i] !== b[i]) return false
            }
            return true
        }

        // Helper function for checking configuration equality
        const configsEqual = (
            a: InterpreterConfiguration,
            b: InterpreterConfiguration
        ): boolean => {
            // States must be equal
            if (a.state !== b.state) {
                return false
            }
            // Words must be equal
            if (!arraysEqual(a.word, b.word)) {
                return false
            }
            // Stacks must be equal
            if (!arraysEqual(a.stack, b.stack)) {
                return false
            }
            return true
        }

        // Loop over all set values to check if searchConfig is unique
        const configs = this.values()
        for (const config of configs) {
            if (configsEqual(searchConfig, config)) {
                // If searchConfig found in current configs, has() === true
                return true
            }
        }

        // If searchConfig not found in current configs, has() === false
        return false
    }
}

// An interpreter reads words and either accepts or rejects them
export class Interpreter {
    definition: InterpreterDefinition
    configs!: ConfigurationSet
    ticks!: number
    maxTicks!: number

    // On interpreter creation, store definition
    // and create initial configuration
    constructor(definition: InterpreterDefinition, maxTicks = -1) {
        this.definition = definition
        this.maxTicks = maxTicks
        this.reset()
    }

    // Resets interpreter to initial configuration
    reset(word: AlphabetSymbol[] = []): void {
        this.ticks = 0
        this.configs = new ConfigurationSet()
        this.configs.add({
            word,
            state: this.definition.initialState,
            stack: [this.definition.initialStackSymbol],
        })
    }

    // Set maximum amount of ticks allowed for interpreter
    setMaxTicks(maxTicks: number) {
        this.maxTicks = maxTicks
    }

    // Interpreter compute iteration
    tick() {
        this.ticks++
    }

    // Whether the interpreter accepts some configuration
    acceptsCurrentConfiguration(config: InterpreterConfiguration) {
        // A word can be accepted only if it has been read
        if (config.word.length !== 0) {
            return false
        }

        // Check acceptance criteria based on interpreter type
        if (this.definition.acceptThroughEmptyStack) {
            // Accept through empty stack
            return config.word.length === 0 && config.stack.length === 0
        } else {
            // Accept through read word
            return this.definition.acceptedStates.includes(config.state)
        }
    }

    // Whether the interpreter accepts any of its current configurations
    acceptsCurrentConfigurations() {
        for (const config of this.configs) {
            if (this.acceptsCurrentConfiguration(config)) {
                return true
            }
        }
        return false
    }

    // Whether the interpreter would accept some given word
    acceptsWord(word: AlphabetSymbol[]): boolean {
        // Reset interpreter configurations
        this.reset(word)

        // Keep ticking while not accepting
        while (!this.acceptsCurrentConfigurations()) {
            // Break on max tick limit, if it's enabled
            if (this.maxTicks > 0 && this.ticks > this.maxTicks) {
                throw new TickLimitError(
                    `Reached debug tick limit ${this.maxTicks}, couldn't accept word`
                )
            }

            // Print configurations for each tick in debug mode
            if (isDebug) {
                console.log(`Tick no. ${this.ticks}, current configs:`)
                console.log(this.configs)
            }

            // Tick in each iteration
            this.tick()
        }

        // If the loop above broke, it's because the word was accepted
        return true
    }
}

// Parse program arguments and read automata file
export const readAutomata = (
    automatapath: string,
    callback: (automata: Buffer | string) => unknown
) => {
    readFile(automatapath, (err, automatadata) => {
        if (err) {
            throw new Error(`Failed to read automata ${automatapath}: ${err}`)
        } else {
            callback(automatadata)
        }
    })
}

// Parse program arguments and read automata file
export const readAutomataFromParameter = (
    callback: (automata: Buffer | string) => unknown
) => {
    if (process.argv.length !== 3) {
        const message =
            'Program expects one argument - magazine automata path. ' +
            `Received ${process.argv.length} arguments: ${process.argv} `

        throw new Error(message)
    } else {
        const automatapath = process.argv[2]
        readAutomata(automatapath, automatadata => {
            callback(automatadata)
        })
    }
}

// Parse automata string and return an initialised Interpreter
export const parseAutomata = (
    automataFile: Buffer | string,
    callback: (interpreter: Interpreter) => unknown
) => {
    // Transform automata data to string format
    const automataText = automataFile.toString()

    // Parse automata definition text
    const [
        states,
        alphabetSymbols,
        stackSymbols,
        initialStates,
        initialStackSymbols,
        acceptedStates,
        acceptThroughEmptyStackSymbols,
        ...transitionLines
    ] = automataText
        .trim()
        .split('\n')
        .map(line =>
            line
                .trim()
                .split(' ')
                .map(word => word.trim())
        )

    // Extra parsing on transitions
    const transitions: Transition[] = transitionLines.map(transition => {
        const [
            fromState,
            inputSymbol,
            inputStackSymbolsSerialized,
            toState,
            outputStackSymbolsSerialized,
            ...other
        ] = transition
        const inputStackSymbols = inputStackSymbolsSerialized.split('')
        const outputStackSymbols = outputStackSymbolsSerialized.split('')
        if (other.length > 0) {
            throw new Error(
                `Transition line contains more data than needed: ${transition}`
            )
        }
        return {
            fromState,
            inputSymbol,
            inputStackSymbols,
            toState,
            outputStackSymbols,
        } as Transition
    })

    // Assertions on definition
    if (initialStates.length !== 1) {
        throw new Error('Initial state line should contain one state')
    }
    const initialState = initialStates[0]

    if (initialStackSymbols.length !== 1) {
        throw new Error('Initial stack symbol line should contain one state')
    }
    const initialStackSymbol = initialStackSymbols[0]

    if (acceptThroughEmptyStackSymbols.length !== 1) {
        throw new Error(
            "Accept through emptying line should contain 'E' or 'F'"
        )
    }
    const acceptThroughEmptyStackSymbol = acceptThroughEmptyStackSymbols[0]
    let acceptThroughEmptyStack
    if (acceptThroughEmptyStackSymbol === 'E') {
        acceptThroughEmptyStack = true
    } else if (acceptThroughEmptyStackSymbol === 'F') {
        acceptThroughEmptyStack = false
    } else {
        throw new Error(
            "Accept through stack emptying line should contain 'E' or 'F'"
        )
    }

    // Create automata interpreter instance and its definition
    const definition: InterpreterDefinition = {
        states,
        alphabetSymbols,
        stackSymbols,
        initialState,
        initialStackSymbol,
        acceptedStates,
        acceptThroughEmptyStack,
        transitions,
    }
    const interpreter = new Interpreter(definition)

    callback(interpreter)
}

// Automata read-eval-print loop
export const replAutomata = (automata: Interpreter) => {
    // Inform user in debug mode about read automata
    if (isDebug) {
        console.log('Defined automata:')
        console.log(inspect(automata.definition, false, null, true))
    }

    // Set max tick limit in debug mode
    automata.setMaxTicks(environmentMaxTicks)

    // Initialize console interface
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    // Define interactive word inquiry process
    console.log('To stop the interactive console, use Ctrl-C')
    const inquire = () => {
        rl.question('Insert word for interpreter: ', word => {
            console.log(`Read word: ${word}`)
            const alphabetizedWord: AlphabetSymbol[] = word.split('')
            try {
                if (automata.acceptsWord(alphabetizedWord)) {
                    console.log(`Accepted word ${word}`)
                } else {
                    console.log(`Rejected word ${word}`)
                }
            } catch (e) {
                if (e instanceof TickLimitError) {
                    console.log(`Interpreter reached tick limit: ${e.message}`)
                } else {
                    // Unknown error, keep throwing
                    throw e
                }
            }
            console.log()
            inquire()
        })
    }
    
    // Start inquiry process
    inquire()
}

// Executable usage (only if executed directly, not imported)
// Src: https://stackoverflow.com/a/4981943
if (!module.parent) {
    // Find and read automata definition file
    readAutomataFromParameter(automatadata => {
        if (isDebug) console.log(`Read automata {\n${automatadata}\n}`)
        
        // Initialize automata from definition
        parseAutomata(automatadata, automata => {
            // Start automata REPL
            replAutomata(automata)
        })
    })

}