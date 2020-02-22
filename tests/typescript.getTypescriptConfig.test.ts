import {getTypescriptConfig, makeDefaultTypescriptConfig} from '../src/typescript'

describe('getTypescriptConfig', () => {
    it('returns default typescript configuration if the one provided does not exist', () => {
        expect(
            getTypescriptConfig('/ciaone/my-folder'),
        ).toEqual(
            makeDefaultTypescriptConfig()
        )
    })

    it ('should throw an error if configured typescript configuration does not exist', () => {
        expect(() =>
            getTypescriptConfig(process.cwd(), {
                service: {
                    custom: {
                        typeScript: {
                            tsconfigFilePath: './some-path'
                        }
                    }}
                } as any),
        ).toThrowError('Custom Typescript Config File not found')
    })

    it ('returns configured typescript configuration if provided', () => {
        expect(
            getTypescriptConfig(process.cwd(), {
                service: {
                    custom: {
                        typeScript: {
                            tsconfigFilePath: './tests/custom.tsconfig.json'
                        }
                    }}
                }).target,
        ).toEqual(2)
    })
})