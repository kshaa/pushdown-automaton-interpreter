import {
    InterpreterConfiguration,
    ConfigurationSet,
} from '../../code/interpreter'
import { describe } from 'mocha'
import { assert } from 'chai'

describe('[Unit] Configuration set', () => {
    it(`Should not allow duplicates`, done => {
        const set = new ConfigurationSet()
        const config: InterpreterConfiguration = {
            word: ['a', 'b', 'c'],
            state: 'Q1',
            stack: ['Z'],
        }
        set.add(config)
        set.add(config)
        assert.equal(set.size, 1, 'Duplicate was added in set')
        done()
    })
})
