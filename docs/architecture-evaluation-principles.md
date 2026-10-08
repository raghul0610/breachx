# Breach X Architecture Evaluation Principles

Breach X evaluates an architecture against its stated purpose and requirements rather than
counting components.

The evaluation model is organized around:
- requirement fit
- end-to-end request flow
- scalability
- reliability and failure isolation
- security trust boundaries
- durable data and consistency
- performance and asynchronous work
- operability and recovery
- complexity proportionality
- explicit trade-offs

The reviewer must distinguish required capabilities from optional best practices. A simple
architecture is not bad because it lacks distributed-system machinery. A complex architecture
is not good because it contains many components.

Findings require evidence from the architecture graph or an explicit omission. Severity is
based on impact to the stated purpose and requirements.

This framework is informed by the architecture-evaluation goal of assessing an architecture
with respect to its intended purpose, stakeholder concerns, risks and opportunities, as
described by ISO/IEC/IEEE 42030:2019.
