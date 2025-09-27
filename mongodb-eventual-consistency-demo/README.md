The cft in this folder deploys mongodb with replicaset across three ec2 instances and a UI instance that can write to the db and read from all the nodes. The read happens every 5 seconds, so this UI can be used for experimenting with eventual consistency and fault tolerance of mongodb. 

Check out this video: https://www.youtube.com/watch?v=KdOeu8DOkV4 here I am starting with setting "secondaryDelaySecs" to 20 second for one of the node. After that when I am doing a write you can see the node with private IP 10.0.0.12, which is node 3 in this case receives the update with a delay. Also in this video I am rebooting one of the node(ec2) and the effect can be seen in the UI, that particular node doesn't show any data while rebooting, and once rebooted, it receives all the sync including the writes that happened when it was down.

The secondaryDelaySecs was changed manually for one of the instance by running the below from the primary node.

```
cfg = rs.conf()

for (let i = 0; i < cfg.members.length; i++) {
 if (cfg.members[i].host.indexOf("10.0.0.12") >= 0) {
 cfg.members[i].priority = 0      // prevent primary election
 cfg.members[i].hidden = true     // optional: hide from drivers
 cfg.members[i].secondaryDelaySecs = 20 // delay replication by 20s
 }
}

rs.reconfig(cfg, {force: true})
```
