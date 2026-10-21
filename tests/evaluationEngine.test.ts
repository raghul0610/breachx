import { describe, it, expect } from 'vitest';
import { evaluateSystemDesign } from '../src/lib/evaluationEngine';
import type { EvaluationInput } from '../src/lib/evaluationEngine';

describe('Evaluation Engine Graph Analysis and Deterministc Rules', () => {
  
  it('handles basic CRUD application (well-connected)', () => {
    const input: EvaluationInput = {
      application: { name: 'CRUD', description: 'Basic CRUD app' },
      nodes: [
        { id: 'client', data: { typeKey: 'client' } },
        { id: 'api', data: { typeKey: 'api_server' } },
        { id: 'db', data: { typeKey: 'database' } }
      ],
      edges: [
        { source: 'client', target: 'api' },
        { source: 'api', target: 'db' }
      ]
    };
    
    const result = evaluateSystemDesign(input);
    expect(result.graphAnalysis).toBeDefined();
    expect(result.graphAnalysis?.entryPoints).toContain('client');
    expect(result.graphAnalysis?.reachabilityFromEntry['client']).toContain('api');
    expect(result.graphAnalysis?.reachabilityFromEntry['client']).toContain('db');
    // Shouldn't have ARCH_NO_INGRESS or ARCH_NO_COMPUTE
    expect(result.findings.some(f => f.id === 'ARCH_NO_INGRESS')).toBe(false);
    expect(result.findings.some(f => f.id === 'ARCH_UNREACHABLE_COMPUTE')).toBe(false);
  });

  it('handles high-throughput system', () => {
    const input: EvaluationInput = {
      application: { name: 'High Throughput', description: 'Massive scale events' },
      workload: { expectedUsers: 2000000, peakRps: 5000, latencyMs: 50 },
      nodes: [
        { id: 'client', data: { typeKey: 'client' } },
        { id: 'lb', data: { typeKey: 'load_balancer' } },
        { id: 'api1', data: { typeKey: 'api_server' } },
        { id: 'api2', data: { typeKey: 'api_server' } },
        { id: 'cache', data: { typeKey: 'cache' } },
        { id: 'db', data: { typeKey: 'database', notes: 'replica' } } // To satisfy REL_SINGLE_STORE
      ],
      edges: [
        { source: 'client', target: 'lb' },
        { source: 'lb', target: 'api1' },
        { source: 'lb', target: 'api2' },
        { source: 'api1', target: 'cache' },
        { source: 'api1', target: 'db' },
        { source: 'api2', target: 'cache' },
        { source: 'api2', target: 'db' }
      ]
    };
    
    const result = evaluateSystemDesign(input);
    expect(result.graphAnalysis).toBeDefined();
    expect(result.graphAnalysis?.entryPoints).toContain('client');
    expect(result.findings.some(f => f.id === 'SCALE_SINGLE_COMPUTE')).toBe(false);
  });

  it('handles banking application (sensitive data, transactions)', () => {
    const input: EvaluationInput = {
      application: { name: 'Banking', description: 'Financial transactions' },
      notes: 'Requires authentication and authorization. Sensitive data.',
      nodes: [
        { id: 'client', data: { typeKey: 'client' } },
        { id: 'gateway', data: { typeKey: 'api_gateway', notes: 'Handles auth and rate limits' } },
        { id: 'auth', data: { typeKey: 'auth_service' } },
        { id: 'service', data: { typeKey: 'transaction_processor' } },
        { id: 'db', data: { typeKey: 'database' } }
      ],
      edges: [
        { source: 'client', target: 'gateway' },
        { source: 'gateway', target: 'auth' },
        { source: 'gateway', target: 'service' },
        { source: 'service', target: 'db' }
      ]
    };
    
    const result = evaluateSystemDesign(input);
    expect(result.findings.some(f => f.id === 'SEC_NO_BOUNDARY')).toBe(false);
    expect(result.findings.some(f => f.id === 'SEC_PUBLIC_DATA_STORE')).toBe(false);
  });

  it('flags a client connected directly to a database as a critical security issue', () => {
    const input: EvaluationInput = {
      application: { name: 'Messaging app', description: 'A user-facing app that stores private messages and account data.' },
      nodes: [
        { id: 'client', data: { label: 'Client App', typeKey: 'client' } },
        { id: 'db', data: { label: 'Private Database', typeKey: 'database' } },
        { id: 'cdn', data: { label: 'CDN', typeKey: 'cdn' } },
      ],
      edges: [{ id: 'client-db', source: 'client', target: 'db' }, { id: 'client-cdn', source: 'client', target: 'cdn' }],
    };
    const result = evaluateSystemDesign(input);
    const finding = result.findings.find((item) => item.id === 'SEC_PUBLIC_DATA_STORE');
    expect(finding?.severity).toBe('critical');
    expect(finding?.nodeIds).toEqual(expect.arrayContaining(['client', 'db']));
    expect(finding?.edgeIds).toContain('client-db');
  });

  it('does not flag a client routed through an application boundary to the database', () => {
    const input: EvaluationInput = {
      application: { name: 'CRUD app', description: 'A basic CRUD application with private persistent data.' },
      nodes: [
        { id: 'client', data: { label: 'Client App', typeKey: 'client' } },
        { id: 'api', data: { label: 'Application API', typeKey: 'api_server' } },
        { id: 'db', data: { label: 'Private Database', typeKey: 'database' } },
      ],
      edges: [{ id: 'client-api', source: 'client', target: 'api' }, { id: 'api-db', source: 'api', target: 'db' }],
    };
    const result = evaluateSystemDesign(input);
    expect(result.findings.some((item) => item.id === 'SEC_PUBLIC_DATA_STORE')).toBe(false);
  });
  it('handles ChatGPT-like application', () => {
    const input: EvaluationInput = {
      application: { name: 'ChatBot', description: 'ChatGPT clone' },
      nodes: [
        { id: 'client', data: { typeKey: 'client' } },
        { id: 'gateway', data: { typeKey: 'api_gateway' } },
        { id: 'app', data: { typeKey: 'api_server' } },
        { id: 'llm', data: { typeKey: 'llm_gateway' } },
        { id: 'db', data: { typeKey: 'database' } }
      ],
      edges: [
        { source: 'client', target: 'gateway' },
        { source: 'gateway', target: 'app' },
        { source: 'app', target: 'llm' },
        { source: 'app', target: 'db' }
      ]
    };
    const result = evaluateSystemDesign(input);
    expect(result.graphAnalysis?.entryPoints).toContain('client');
  });

  it('handles RAG application', () => {
    const input: EvaluationInput = {
      application: { name: 'RAG App', description: 'RAG system' },
      nodes: [
        { id: 'client', data: { typeKey: 'client' } },
        { id: 'api', data: { typeKey: 'api_server' } },
        { id: 'embed', data: { typeKey: 'embedding_service' } },
        { id: 'vector', data: { typeKey: 'vector_database' } },
        { id: 'llm', data: { typeKey: 'llm_gateway' } }
      ],
      edges: [
        { source: 'client', target: 'api' },
        { source: 'api', target: 'embed' },
        { source: 'api', target: 'vector' },
        { source: 'api', target: 'llm' }
      ]
    };
    const result = evaluateSystemDesign(input);
    expect(result.graphAnalysis?.reachabilityFromEntry['client']).toContain('vector');
  });
});

