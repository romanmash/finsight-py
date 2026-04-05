"""Pulumi program for FinSight infrastructure."""

from __future__ import annotations

import os

import pulumi
import pulumi_hcloud as hcloud

config = pulumi.Config()

server_type = config.get("server_type") or "cx21"
region = config.get("region") or "nbg1"
volume_size_gb = config.get_int("volume_size_gb") or 20

public_key = os.environ["PULUMI_SSH_PUBLIC_KEY"]
ssh_key = hcloud.SshKey("finsight-key", public_key=public_key)

server = hcloud.Server(
    "finsight-server",
    server_type=server_type,
    image="ubuntu-24.04",
    location=region,
    ssh_keys=[ssh_key.id],
)

hcloud.Firewall(
    "finsight-fw",
    rules=[
        hcloud.FirewallRuleArgs(
            direction="in",
            protocol="tcp",
            port="22",
            source_ips=["0.0.0.0/0", "::/0"],
        ),
        hcloud.FirewallRuleArgs(
            direction="in",
            protocol="tcp",
            port="80",
            source_ips=["0.0.0.0/0", "::/0"],
        ),
        hcloud.FirewallRuleArgs(
            direction="in",
            protocol="tcp",
            port="443",
            source_ips=["0.0.0.0/0", "::/0"],
        ),
    ],
    apply_to=[hcloud.FirewallApplyToArgs(server=server.id)],
)

hcloud.Volume(
    "postgres-data",
    size=volume_size_gb,
    location=region,
    server_id=server.id,
    format="ext4",
)

pulumi.export("server_ip", server.ipv4_address)
