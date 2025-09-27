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

The UI ec2 can be launched using its public IP at http://<publicip>:3000

it looks like this, here you can see I inserted text "time" and it appears in just the 1st node third node has it recive it after a delay and 2nd node is down at this point:

<img width="1572" height="879" alt="image" src="https://github.com/user-attachments/assets/9660bcd4-4f44-4b9f-9e60-8359cafdff9f" />

This is after 3rd node recived the update:

<img width="1578" height="836" alt="image" src="https://github.com/user-attachments/assets/259f07fc-289e-4550-a662-61aae2fdac5d" />

And this is after 2nd node is back:

<img width="1582" height="805" alt="image" src="https://github.com/user-attachments/assets/7b4f4755-c033-49e8-8aac-b40d4ba45ccd" />

Added a label showing which node is primary and which is secondary , thus one more experiment can be done here by rebooting the primary node to see a new primary being elected

<img width="1919" height="880" alt="image" src="https://github.com/user-attachments/assets/20a6a953-44ba-4814-baf0-00c3d8e012a5" />



