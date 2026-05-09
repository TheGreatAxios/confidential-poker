import { MemorySaver } from "@langchain/langgraph-checkpoint";
import type {
  ChannelVersions,
  Checkpoint,
  CheckpointMetadata,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";

export class SafeMemorySaver extends MemorySaver {
  override async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions?: ChannelVersions,
  ): Promise<RunnableConfig> {
    return super.put(config, {
      ...checkpoint,
      pending_sends: checkpoint.pending_sends ?? [],
    }, metadata);
  }
}
