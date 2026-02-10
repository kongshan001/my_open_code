import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSystemPrompt } from '../../src/system-prompt.js'

describe('System Prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return a non-empty system prompt', () => {
    const prompt = getSystemPrompt()
    
    expect(prompt).toBeDefined()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('should contain essential AI assistant instructions', () => {
    const prompt = getSystemPrompt()
    
    expect(prompt.toLowerCase()).toContain('assistant')
    expect(prompt.toLowerCase()).toContain('help')
  })

  it('should mention tool usage capabilities', () => {
    const prompt = getSystemPrompt()
    
    expect(prompt.toLowerCase()).toContain('tool')
  })

  it('should be consistent across multiple calls', () => {
    const prompt1 = getSystemPrompt()
    const prompt2 = getSystemPrompt()
    
    expect(prompt1).toBe(prompt2)
  })

  it('should be properly formatted for LLM consumption', () => {
    const prompt = getSystemPrompt()
    
    // Should not have leading/trailing whitespace
    expect(prompt).toBe(prompt.trim())
    
    // Should be reasonably sized (not too short, not too long)
    expect(prompt.length).toBeGreaterThan(50)
    expect(prompt.length).toBeLessThan(5000)
  })
})