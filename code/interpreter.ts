// Author: Krišjānis Veinbahs
// Student ID: kv18042
// Description: Magazine automata interpreter

import { readFile } from 'fs'
import readline from 'readline'
import { inspect } from 'util'

// Check if running in debug mode
const isDebugMode = process.env['DEBUG']

// Maximum amount of automata ticks allowed
const environmentMaxTicksSerialized = process.env['MAX_TICKS']
let environmentMaxTicks = 2000
if (environmentMaxTicksSerialized && environmentMaxTicksSerialized.length > 0) {
    environmentMaxTicks = Number(environmentMaxTicksSerialized)
}

export type State = string
export type AlphabetSymbol = string
export type StackSymbol = string
export interface Transition {
    fromState: State
    inputSymbol: AlphabetSymbol | null
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

// An interpreter configuration describes a specific
// state in which the automata is in
export interface InterpreterConfiguration {
    stack: StackSymbol[]
    word: AlphabetSymbol[]
    state: State
    history: InterpreterConfiguration[]
}

// Check if stack has a word at its top
export const hasStackWord = (
    stack: StackSymbol[],
    word: StackSymbol[]
): boolean => {
    // Stack must have enough symbols
    if (stack.length < word.length) {
        return false
    }

    // Check if the top of stack has the word and all letter match
    for (let i = 0; i < word.length; i++) {
        // If any letter doesn't match then the stack doesn't have the word
        if (stack[stack.length - i - 1] !== word[word.length - i - 1]) {
            return false
        }
    }

    // If all letters matched then word is present
    return true
}

// Remove symbols from stack top
export const stackPop = (
    stack: StackSymbol[],
    count: number
): StackSymbol[] => {
    return stack.slice(0, stack.length - count)
}

// Add symbols to stack top
export const stackPush = (
    stack: StackSymbol[],
    word: StackSymbol[]
): StackSymbol[] => {
    return stack.concat(word)
}

// Validate if transition can be performed on state
export const validTransition = (
    config: InterpreterConfiguration,
    transition: Transition
): boolean => {
    const stateMatches = transition.fromState === config.state
    const stackMatches = hasStackWord(
        config.stack,
        transition.inputStackSymbols
    )
    const inputSymbolMatches =
        transition.inputSymbol === null ||
        (config.word.length >= 1 && transition.inputSymbol === config.word[0])

    return stateMatches && stackMatches && inputSymbolMatches
}

// Blindly without any checks, perform configuration transition
export const performTransition = (
    config: InterpreterConfiguration,
    transition: Transition
): InterpreterConfiguration => {
    const state = transition.toState
    const word =
        transition.inputSymbol === null ? config.word : config.word.slice(1)
    const stack = stackPush(
        stackPop(config.stack, transition.inputStackSymbols.length),
        transition.outputStackSymbols
    )
    const history = config.history.concat([config])
    return {
        state,
        word,
        stack,
        history,
    }
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

// Helper function for calculating set union
// Src: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
export const union = <T extends unknown>(
    setA: Set<T>,
    setB: Set<T>
): Set<T> => {
    const _union = new Set(setA)
    for (const elem of setB) {
        _union.add(elem)
    }
    return _union
}

// Helper function for calculating set difference
// Src: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
export const difference = <T extends unknown>(
    setA: Set<T>,
    setB: Set<T>
): Set<T> => {
    const _difference = new Set(setA)
    for (const elem of setB) {
        _difference.delete(elem)
    }
    return _difference
}

// An interpreter reads words and either accepts or rejects them
export class Interpreter {
    definition: InterpreterDefinition
    configs!: ConfigurationSet
    ticks!: number
    maxTicks!: number
    debugMode!: boolean

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
            state: this.definition.initialState,
            word,
            stack: [this.definition.initialStackSymbol],
            history: [],
        })
    }

    // Set debug mode for interpreter
    setDebugMode(debugMode: boolean) {
        this.debugMode = debugMode
    }

    // Set maximum amount of ticks allowed for interpreter
    setMaxTicks(maxTicks: number) {
        this.maxTicks = maxTicks
    }

    // Interpreter compute iteration
    tick() {
        // Create storage for configs created throughout this tick
        const newTickConfigs = new ConfigurationSet()

        // For every current config, transition to new configs
        for (const config of this.configs) {
            const validTransitions = this.definition.transitions.filter(
                transition => validTransition(config, transition)
            )
            for (const transition of validTransitions) {
                const newConfig = performTransition(config, transition)
                newTickConfigs.add(newConfig)
            }
        }

        this.configs = newTickConfigs

        // Bump tick counter
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

    // Find the first currently accepted configurations, if it exists
    getFirstAcceptedCurrentConfiguration() {
        for (const config of this.configs) {
            if (this.acceptsCurrentConfiguration(config)) {
                return config
            }
        }
        return null
    }

    // Alias for `getFirstAcceptedCurrentConfiguration`
    acceptsCurrentConfigurations() {
        return this.getFirstAcceptedCurrentConfiguration() !== null
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
            if (this.debugMode) {
                console.log(`Tick no. ${this.ticks}, current configs:`)
                console.log(this.configs)
            }

            // Tick in each iteration
            this.tick()
        }

        // If the loop above broke, it's because the word was accepted
        return true
    }

    printAcceptionTransitions() {
        const printConfig = (config: InterpreterConfiguration) => {
            console.log(
                `{ state: ${config.state}, ` +
                    `word: [ ${config.word.join(', ')} ], ` +
                    `stack: [ ${config.stack.join(', ')} ] }`
            )
        }
        const acceptedConfig = this.getFirstAcceptedCurrentConfiguration()
        if (acceptedConfig) {
            console.log(`Accepted using the following transitions:`)
            for (const historyConfig of acceptedConfig.history) {
                printConfig(historyConfig)
            }
            printConfig(acceptedConfig)
        } else {
            console.log("Word couldn't be accepted through any transitions")
        }
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
export const EMPTY_ALPHABET_SYMBOL: AlphabetSymbol = 'e'
export const EMPTY_STACK_SYMBOL: StackSymbol = 'e'
export const parseAutomata = (
    automataFile: Buffer | string,
    callback: (interpreter: Interpreter) => unknown
) => {
    // Transform automata data to string format
    const automataText = automataFile.toString()

    // Parse lines and words in automata definition text
    const automataLines = automataText.trim().split('\n')
    const automataWordLines = automataLines.map(line =>
        line
            .trim()
            .split(' ')
            .map(word => word.trim())
    )

    // Split lines and words in definition into appropriate parts
    const [
        states,
        alphabetSymbols,
        stackSymbols,
        initialStates,
        initialStackSymbols,
        acceptedStates,
        acceptThroughEmptyStackSymbols,
        ...transitionLines
    ] = automataWordLines

    // Extra parsing on transitions
    const transitions: Transition[] = transitionLines.map(transition => {
        const [
            fromState,
            inputSymbolSerialized,
            inputStackSymbolsSerialized,
            toState,
            outputStackSymbolsSerialized,
            ...other
        ] = transition

        // Stacks are reversed, because professor uses a more human-readable
        // notation, which is impractical for computers
        let inputStackSymbols: StackSymbol[] = []
        if (inputStackSymbolsSerialized !== EMPTY_STACK_SYMBOL) {
            inputStackSymbols = inputStackSymbolsSerialized.split('').reverse()
        }

        let outputStackSymbols: StackSymbol[] = []
        if (outputStackSymbolsSerialized !== EMPTY_STACK_SYMBOL) {
            outputStackSymbols = outputStackSymbolsSerialized
                .split('')
                .reverse()
        }
        if (other.length > 0) {
            throw new Error(
                `Transition line contains more data than needed: ${transition}`
            )
        }

        const inputSymbol =
            inputSymbolSerialized === EMPTY_ALPHABET_SYMBOL
                ? null
                : inputSymbolSerialized

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
    if (isDebugMode) {
        console.log('Defined automata:')
        console.log(inspect(automata.definition, false, null, true))
    }

    // Set max tick limit in debug mode
    automata.setMaxTicks(environmentMaxTicks)

    // Set debug mode, when relevant
    automata.setDebugMode(!!isDebugMode)

    // Initialize console interface
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    // Define interactive word inquiry process
    console.log('To stop the interactive console, use Ctrl-C')
    const inquire = () => {
        rl.question('Insert word for interpreter: ', word => {
            console.log(`Read word: '${word}'`)
            const alphabetizedWord: AlphabetSymbol[] = word.split('')
            try {
                if (automata.acceptsWord(alphabetizedWord)) {
                    console.log(
                        `Accepted word '${word}' in ${automata.ticks} ticks`
                    )
                    automata.printAcceptionTransitions()
                } else {
                    console.log(
                        `Rejected word '${word}' in ${automata.ticks} ticks`
                    )
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
        if (isDebugMode) console.log(`Read automata {\n${automatadata}\n}`)

        // Initialize automata from definition
        parseAutomata(automatadata, automata => {
            // Start automata REPL
            replAutomata(automata)
        })
    })
}
