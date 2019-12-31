// Metadata holds info pertaining to event retention.
export interface Metadata {
  // The max age of an event after which it can be discarded.
  maxAge: number
  // The max count of events in a thread after which the oldest can be discarded.
  maxCount: number
}

// Role represents a peer access role.
export enum Role {
  NoAccess = 0, // NoAccess is granted.
  Follow, // Follow access is granted.
  Read, // Read access is granted.
  Write, // Write access is granted.
  Delete, // Delete access is granted.
}

// Roles defines the default and peer-based access roles for a thread / doc.
export interface Roles {
  // Default holds a default Role for all peers.
  default: Role
  // Peers holds Roles for specific peers.
  peers: Record<string, Role> // @todo: use peer.id alias here?
}

// ACL defines the access roles for a thread and its docs.
export interface ACL {
  roles: Roles
  docs: Record<string, Roles>
}
