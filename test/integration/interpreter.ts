import { readAutomata, parseAutomata, Interpreter } from '../../code/interpreter'
import { describe } from 'mocha'
import { assert } from 'chai'
import { join } from 'path'

describe('[Integration] Example automata #1', () => {
    const testAutomataOne = (callback: (interpreter: Interpreter) => void) => {
        const automatapath = join(__dirname, './automata1.txt')
        readAutomata(automatapath, automatadata => {
            parseAutomata(automatadata, automata => {
                callback(automata)
            })
        })
    }
    it(`Should accept known correct words`, done => {
        const maxTicksRequired = 1
        const acceptedWords = [
            '', 'aa', 'aaaa', 'bb', 'bbbb', 'aabb', 'aabbbb'
        ]

        testAutomataOne(automata => {
            automata.setMaxTicks(maxTicksRequired)
            for (const word of acceptedWords) {
                const alphabetizedWord = word.split('')
                
                assert.doesNotThrow(() => {
                    automata.acceptsWord(alphabetizedWord)
                })

                assert.equal(
                    automata.acceptsWord(alphabetizedWord),
                    true,
                    `Automata #1 didn't accept known valid word - ${alphabetizedWord}`
                )
            }
            done()
        })
    })
})
