# ANCHON User Guide

ANCHON is a system architecture design workspace. Use it to describe a product, model its architecture, inspect components and connections, trace request flows, evaluate the design, and export a reviewable artifact.

## 1. Start a project

1. Open the project dashboard and create a project.
2. Give the architecture a clear name.
3. In **Requirements**, describe the product, users, core journeys, expected traffic, data sensitivity, latency and availability targets, integrations, and constraints.
4. Save the draft before making substantial changes.

A useful brief states measurable assumptions. For example, specify peak requests per second, expected data volume, retention, target p95 latency, availability objective, deployment region, and budget.

## 2. Build the architecture

1. Open **Component Library** from the workspace toolbar.
2. Search or browse by category.
3. Select a component to inspect its responsibility, use cases, and trade-offs.
4. Add it to the canvas, or drag it onto the canvas where supported.
5. Arrange components so the major request and event paths are readable.

Start with the critical path. Add caches, queues, workers, replicas, and observability components only when they address an identified requirement or failure mode.

## 3. Connect components

- Drag from a source handle to a target handle to create a directed connection.
- Label or inspect connections where the interface provides connection details.
- Keep synchronous request paths distinct from asynchronous event flows.
- Check that every important flow has a clear entry point, destination, and failure response.

## 4. Inspect and refine

Select a node to open its contextual Inspector. Review the component's role, configuration, ownership, security boundary, and operational concerns. Inspect connections for protocol and data-flow assumptions. The Inspector is contextual; it is not a permanently open right sidebar.

## 5. Use ANCHON AI

Use the architecture assistant to clarify requirements, explore alternatives, or propose architecture changes. Give it a precise engineering brief: product goal, user roles, traffic, data, quality attributes, constraints, and preferred technologies. Review proposed changes before applying or saving them. Generated output is a design aid, not production certification.

## 6. Trace a request

Use **Run Request** to simulate a request through the connected architecture. Confirm that the intended path reaches its destination. If the trace cannot reach the destination, inspect missing or incorrectly directed connections.

## 7. Evaluate the architecture

Run the architecture evaluation after the main components and connections are in place. Treat findings as review prompts. Resolve high-impact gaps in security, reliability, scalability, data ownership, and observability; document justified trade-offs.

## 8. Save and export

- **Save Draft** persists the current architecture.
- **Export PDF** creates a readable architecture snapshot.
- Use **Share** to copy a structured JSON snapshot where available.

Before sharing, verify that the project brief, component names, connections, and assumptions are accurate.

## 9. Account settings

Use **Settings** to manage profile details, authentication email, password-based sign-in, and active sessions. Email changes may require confirmation from the authentication provider.

## Design review checklist

- Are functional and non-functional requirements explicit?
- Is each component's responsibility clear?
- Are synchronous and asynchronous paths distinguished?
- Are retries, timeouts, idempotency, and failure handling addressed?
- Are authentication, authorization, and sensitive data boundaries explicit?
- Are data ownership, consistency, retention, and backup assumptions documented?
- Are latency, throughput, availability, and cost targets measurable?
- Can the architecture be operated and observed?
