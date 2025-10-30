from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('game', '0014_character_contract_address_character_minted_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='battle',
            name='onchain_status',
            field=models.CharField(blank=True, db_index=True, max_length=16, null=True),
        ),
        migrations.AddField(
            model_name='battle',
            name='onchain_tx_hash',
            field=models.CharField(blank=True, max_length=66, null=True),
        ),
        migrations.AddField(
            model_name='battle',
            name='onchain_block_number',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='battle',
            name='onchain_timestamp',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='battle',
            name='onchain_contract',
            field=models.CharField(blank=True, max_length=42, null=True),
        ),
        migrations.AddField(
            model_name='battle',
            name='ipfs_cid',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='battle',
            name='result_hash',
            field=models.CharField(blank=True, max_length=66, null=True),
        ),
        migrations.AddField(
            model_name='battle',
            name='onchain_error',
            field=models.TextField(blank=True, null=True),
        ),
    ]


