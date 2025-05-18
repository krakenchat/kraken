# TODOs

## RBAC

### Auth:

- [x] Implement Role-Based Access Control (RBAC) for different user roles.
- [ ] Define these roles dynamically in the database and associate allow actions with the roles
- [ ] Ensure that users are able to perform their action on a resource (community or instance) based on their role.
- [ ] Invalidate cache when a user's role changes (what cache?)
- [ ] Bake in default roles for a new instance but allow these to be changed
- [ ] Always allow owners to do everything to prevent lockout
- [ ] Check channel/communtiy membership separately of role
- [x] Implement refresh tokens
- [ ] Roles are going to get convoluted fast especially when we have things like create but not update
- [ ] Fix the resourceId lookups, the structure is there but it needs to be finalized (we can do this after when we have use-cases in place)

### Database Seeding

- [ ] Seed the database with default roles and permissions.
- [ ] Seed the database with the default user and password (e.g., admin/admin) for testing purposes.
- [ ] Create a default community

### Caching:

- [ ] Add it.

### Reverse proxy:

- [ ] Test out the throttler if we are behind NPM or another reverse proxy

### On the fly updates

- [ ] Implement websocket messages that "invalidate" certain aspects of the frontend cache and re-trigger a fetch (eg. new community, new channel, etc.)

### Configuration Management:

- [ ] Add configuration management for server-wide settings like max # of communities and max # of members per community etc

### Error Handling

- [ ] Improve error handling and make more robust responses for known errors (eg creating a channel for non-existent community)
- [ ] There's a lot of repetition in how we handle errors, make a util or something to handle errors with maybe some optional custom messaging templates

### Resource Limits

- [ ] Need to enforce some degree of resource limits -- max # communities, max # channels, maybe some user-level message limit as well
