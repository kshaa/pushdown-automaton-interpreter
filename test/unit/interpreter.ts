import {
    InterpreterConfiguration,
    ConfigurationSet,
    hasStackWord,
    Transition,
    validTransition,
} from '../../code/interpreter'
import { describe } from 'mocha'
import { assert } from 'chai'

describe('[Unit] Interpreter configuration set', () => {
    it(`Should not allow duplicates`, done => {
        const set = new ConfigurationSet()
        const config: InterpreterConfiguration = {
            word: ['a', 'b', 'c'],
            state: 'Q1',
            stack: ['Z'],
            history: [],
        }
        set.add(config)
        set.add(config)
        assert.equal(set.size, 1, 'Duplicate was added in set')
        done()
    })
})

describe('[Unit] Interpreter configuration stack', () => {
    it(`Should find word if it's present`, done => {
        const stack = ['Z', 'V']
        const stackWord = ['Z', 'V']
        assert.equal(hasStackWord(stack, stackWord), true)
        done()
    })
    it(`Should not find word if it's not present`, done => {
        const stack = ['Z', 'V', 'V']
        const stackWord = ['Z', 'V']
        assert.equal(hasStackWord(stack, stackWord), false)
        done()
    })
})

export interface Validation {
    correct: boolean
    config: InterpreterConfiguration
    transition: Transition
}

describe('[Unit] Interpreter configuration', () => {
    it(`Should properly validate transitions`, done => {
        const validations: Validation[] = [
            {
                correct: true,
                config: {
                    word: [],
                    state: 'Q',
                    stack: ['Z'],
                    history: [],
                },
                transition: {
                    fromState: 'Q',
                    inputSymbol: null,
                    inputStackSymbols: [],
                    toState: 'Q',
                    outputStackSymbols: [],
                },
            },
            {
                correct: true,
                config: {
                    word: ['a'],
                    state: 'Q',
                    stack: ['Z'],
                    history: [],
                },
                transition: {
                    fromState: 'Q',
                    inputSymbol: 'a',
                    inputStackSymbols: [],
                    toState: 'Q',
                    outputStackSymbols: [],
                },
            },
            {
                correct: false,
                config: {
                    word: ['b'],
                    state: 'Q',
                    stack: ['Z'],
                    history: [],
                },
                transition: {
                    fromState: 'Q',
                    inputSymbol: 'a',
                    inputStackSymbols: [],
                    toState: 'Q',
                    outputStackSymbols: [],
                },
            },
        ]

        for (const validation of validations) {
            assert.equal(
                validTransition(validation.config, validation.transition),
                validation.correct,
                `Incorrectly validated ${JSON.stringify(validation)}`
            )
        }

        done()
    })
})
